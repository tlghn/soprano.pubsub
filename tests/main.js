/**
 * Created by tolgahan on 16.11.2016.
 */
"use strict";

const chai = require('chai');
const assert = chai.assert;
const expect = chai.expect;
const should = chai.should;

const Soprano = require('soprano');
const PubSubProtocol = require('../');

const soprano = new Soprano();
const pubSub = new PubSubProtocol(soprano);
var server, controller;

it('Binding', function () {
    return (async function () {
        await soprano.bind(pubSub);
    })();
});

it('Server Listen', function () {
    return (async function () {
        server = await soprano.listen();
    })();
});


it('Client Connection', function () {
    return (async function () {
        controller = await pubSub.connect();
    })();
});

it('Subscription', function () {
    return (async function () {
        let count = await controller.subscribe('test', 'test 2', 'test 3');
        expect(count).to.equal(3);
    })();
});


it('Unsubscription', function () {
    return (async function () {
        let count = await controller.unsubscribe('test 2', 'test 3');
        expect(count).to.equal(1);
    })();
});


it('Publish / Message', function (done) {
    controller.once('message', function (channel) {
        expect(channel).to.equal('test');
        expect(arguments.length).to.equal(4);
        expect(arguments[1]).to.equal(1);
        expect(arguments[2]).to.equal(2);
        expect(arguments[3]).to.equal(3);
        done();
    });

    (async function() {
        await pubSub.publish('test', 1, 2, 3);
    })();
});

