# soprano.pubsub
Publish / Subscription protocol for [soprano](https://www.npmjs.com/package/soprano)

## Install
```
npm i soprano.pubsub --save
```

## Examples

### Basic


server.js

```
const Soprano = require('soprano');
const PubSubProtocol = require('soprano.pubsub');

const soprano = new Soprano();
const pubSub = new PubSubProtocol(soprano);

Soprano.run(function *() {
    yield soprano.bind(pubSub);
    let server = yield soprano.listen();

    while(true){
        yield Soprano.sleep(1000);
        yield pubSub.publish('channelName', 'Hello World');
    }
});


```


client.js

```
const Soprano = require('soprano');
const PubSubProtocol = require('soprano.pubsub');

Soprano.run(function *() {
    const soprano = new Soprano();
    const pubSub = new PubSubProtocol(soprano);
    let controller = pubSub.connect();

    controller.on('message', function(channel){
        console.log(arguments);
    });

    // Subscription
    let subscribedChannelCount = yield controller.subscribe('channelName', 'channelName2');
    console.log(subscribedChannelCount);

    // Unsubscription
    subscribedChannelCount = yield controller.unsubscribe('channelName2');
    console.log(subscribedChannelCount);
});


```





### More Examples ?
Please see the tests directory