/**
 * Created by tolgahan on 16.11.2016.
 */
"use strict";

const zlib = require('zlib');
const crypto = require('crypto');

const FilterFactory = require('soprano').FilterFactory;


class TestFilterFactory extends FilterFactory {

    *createInputFilter(){
        yield [
            zlib.createGunzip(),
            crypto.createDecipher('aes-192-ctr', '123456')
        ];
    }

    *createOutputFilter(){
        yield [
            crypto.createCipher('aes-192-ctr', '123456'),
            zlib.createGzip()
        ];
    }
}

module.exports = TestFilterFactory;