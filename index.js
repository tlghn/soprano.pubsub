/**
 * Created by tolgahan on 19.11.2016.
 */
const HEADER = Buffer.from('PUBSUB', 'utf8');
const Soprano = require('soprano');
const Adapter = Soprano.Adapter;
const SUBSCRIPTIONS = Symbol('subscriptions');
const ID = new Soprano.Id();
const Symbols = Soprano.Symbols;
const debug = Soprano.debug();

class ClientController extends Soprano.Controller {

    constructor(sopranoClient){
        super(sopranoClient);
        this.setResource(SUBSCRIPTIONS, new Set());
        sopranoClient.on('reconnected', function () {
            let set = this.getResource(SUBSCRIPTIONS);
            let args = [...set];
            args.unshift(this);
            Soprano.run(this.subscribe.bind.apply(this.subscribe, args), Soprano.SUPPRESS);
        }.bind(this));
    }

    async subscribe() {
        let channels = Array.prototype.slice.call(arguments);
        if(!channels.length){
            return false;
        }
        let set = this.getResource(SUBSCRIPTIONS);
        this.setResource(SUBSCRIPTIONS, new Set([...set].concat(channels)));
        let id = ID.next();
        await this._write({action: 'subscribe', channels, id});
        return (await this.when[`response_${id}`]())[0];
    }

    async unsubscribe() {
        let channels = Array.prototype.slice.call(arguments);
        let set = this.getResource(SUBSCRIPTIONS);
        if(!channels.length){
            channels = [...set];
            set.clear();
        }

        if(!channels.length){
            return false;
        }

        for(let channel of channels){
            set.delete(channel);
        }

        let id = ID.next();
        await this._write({action: 'unsubscribe', channels, id});
        return (await this.when[`response_${id}`]())[0];
    }

    _handle(err, data){
        var result, name, id;
        if(err){
            result = err;
            id = data && data.id;
        } else if(data.error){
            var _err = data.error;
            var error = Soprano.errors[_err.name] || global[_err.name];
            if(typeof error !== 'function'){
                error = Error;
            }

            error = new error();
            Object.keys(_err).forEach(key => error[key] = _err[key]);
            delete error.stack;
            result = error;
            id = data.id;
        } else {
            name = data.name;
            result = data.result;
            id = data.id;
        }

        if(name === 'message') {
            let args = (data.args || []).slice();
            args.unshift(data.name);
            this.emit.apply(this, args);
        } else {
            this.emit(`response_${id}`, result);
        }


        return true;
    }
}

class ServerController extends Soprano.Controller {
    constructor(sopranoClient){
        super(sopranoClient);
    }

    /**
     * @returns {Adapter}
     */
    get adapter(){
        return this.client.protocol.adapter;
    }

    async sendError(err, id){
        let result = {error: Object.assign({name: err.name, message: err.message}, err), id};
        return await this._write(result);
    }

    async sendResult(result, id){
        return await this._write({result, id});
    }

    async _handle(err, data){

        if(err){
            return await this.sendError(err, data && data.id);
        }

        var channels;
        switch (data.action){
            case 'subscribe':
                channels = new Set(data.channels);
                channels = [...channels];
                channels = await this.adapter.setState(this.id, {script: (function (values) {
                    if(!this.channels){
                        this.channels = new Set(values);
                    } else {
                        for(let value of values){
                            this.channels.add(value);
                        }
                    }
                    return this.channels.size;
                }).toString(), arg: channels});
                return await this.sendResult(channels, data.id);
            case 'unsubscribe':
                channels = new Set(data.channels);
                channels = [...channels];
                channels = await this.adapter.setState(this.id, {script: (function (values) {
                    if(!this.channels){
                        return 0;
                    } else {
                        for(let value of values){
                            this.channels.delete(value);
                        }
                    }
                    return this.channels.size;
                }).toString(), arg: channels});
                return await this.sendResult(channels, data.id);
            default:
                return await this.sendError(new Soprano.errors.InvalidOperationError('Unknown action %s', data.action), data.id);
        }
    }


    async post(message){
        return await this._write(message);
    }
}

class PubSubProtocol extends Soprano.FixedHeaderStreamProtocol {
    constructor(soprano, ns = '', header = void 0){
        super(soprano, header || HEADER);
        this.setResource(Symbols.namespace, ns);
    }

    get namespace(){
        return this.getResource(Symbols.namespace);
    }

    async connect(options = void 0){
        return await this._execute(options);
    }

    async publish(channel){
        var args = Array.prototype.slice.call(arguments);
        var message = {name:'message', args};
        let ids = await this.adapter.findIds({script: function (channel) {
            return this.channels && this.channels.has(channel);
        }.toString(), arg: channel});
        return await this.adapter.post(ids, message);
    }

    //noinspection JSMethodCanBeStatic
    /**
     * @param sopranoClient {SopranoClient}
     * @returns {ClientController}
     */
    createClientController(sopranoClient){
        return new ClientController(sopranoClient);
    }

    //noinspection JSMethodCanBeStatic
    /**
     * @param sopranoClient {SopranoClient}
     * @returns {ServerController}
     */
    createServerController(sopranoClient){
        return new ServerController(sopranoClient);
    }

    //noinspection JSMethodCanBeStatic
    createOutput(){
        return [
            new Soprano.JSONTransformer(false),
            new Soprano.LengthPrefixedTransformer(false)
        ];
    }

    //noinspection JSMethodCanBeStatic
    createInput(){
        return [
            new Soprano.LengthPrefixedTransformer(true),
            new Soprano.JSONTransformer(true)
        ];
    }
}

module.exports = PubSubProtocol;