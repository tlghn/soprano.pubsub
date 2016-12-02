# soprano.pubsub
Publish / Subscription protocol for [soprano](https://www.npmjs.com/package/soprano)

## Install
```
npm i soprano.pubsub --save
```

## Examples

### Basic


server.js

```javascript
const Soprano = require('soprano');
const PubSubProtocol = require('soprano.pubsub');

const soprano = new Soprano();
const pubSub = new PubSubProtocol(soprano);

(async function () {
    await soprano.bind(pubSub);
    let server = await soprano.listen();

    while(true){
        await Soprano.utils.sleep(1000);
        await pubSub.publish('channelName', 'Hello World');
    }
})();


```


client.js

```javascript
const Soprano = require('soprano');
const PubSubProtocol = require('soprano.pubsub');

(async function () {
    const soprano = new Soprano();
    const pubSub = new PubSubProtocol(soprano);
    let controller = await pubSub.connect();

    controller.on('message', function(channel){
        console.log(arguments);
    });

    // Subscription
    let subscribedChannelCount = await controller.subscribe('channelName', 'channelName2');
    console.log(subscribedChannelCount);

    // Unsubscription
    subscribedChannelCount = await controller.unsubscribe('channelName2');
    console.log(subscribedChannelCount);
});


```





### More Examples ?
Please see the tests directory