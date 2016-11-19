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

    *subscribe() {
        let channels = Array.prototype.slice.call(arguments);
        if(!channels.length){
            yield false;
            return;
        }
        let set = this.getResource(SUBSCRIPTIONS);
        this.setResource(SUBSCRIPTIONS, new Set([...set].concat(channels)));
        let id = ID.next();
        yield this._write({action: 'subscribe', channels, id});
        yield this.when[`response_${id}`]();
    }

    *unsubscribe() {
        let channels = Array.prototype.slice.call(arguments);
        let set = this.getResource(SUBSCRIPTIONS);
        if(!channels.length){
            channels = [...set];
            set.clear();
        }

        if(!channels.length){
            yield false;
            return;
        }

        for(let channel of channels){
            set.delete(channel);
        }

        let id = ID.next();
        yield this._write({action: 'unsubscribe', channels, id});
        yield this.when[`response_${id}`]();
    }

    *_handle(err, data){
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


        yield true;
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

    *sendError(err, id){
        let result = {error: Object.assign({name: err.name, message: err.message}, err), id};
        yield this._write(result);
    }

    *sendResult(result, id){
        yield this._write({result, id});
    }

    *_handle(err, data){

        if(err){
            yield this.sendError(err, data && data.id);
            return;
        }

        var channels;
        switch (data.action){
            case 'subscribe':
                channels = new Set(data.channels);
                channels = [...channels];
                channels = yield this.adapter.setState(this.id, {script: (function (values) {
                    if(!this.channels){
                        this.channels = new Set(values);
                    } else {
                        for(let value of values){
                            this.channels.add(value);
                        }
                    }
                    return this.channels.size;
                }).toString(), arg: channels});
                yield this.sendResult(channels, data.id);
                break;
            case 'unsubscribe':
                channels = new Set(data.channels);
                channels = [...channels];
                channels = yield this.adapter.setState(this.id, {script: (function (values) {
                    if(!this.channels){
                        return 0;
                    } else {
                        for(let value of values){
                            this.channels.delete(value);
                        }
                    }
                    return this.channels.size;
                }).toString(), arg: channels});
                yield this.sendResult(channels, data.id);
                break;
            default:
                yield this.sendError(new Soprano.errors.InvalidOperationError('Unknown action %s', data.action), data.id);
        }
    }


    *post(message){
        yield this._write(message);
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

    *connect(options = void 0){
        yield this._execute(options);
    }

    *publish(channel){
        var args = Array.prototype.slice.call(arguments);
        var message = {name:'message', args};
        let ids = yield this.adapter.findIds({script: function (channel) {
            return this.channels && this.channels.has(channel);
        }.toString(), arg: channel});
        yield this.adapter.post(ids, message);
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