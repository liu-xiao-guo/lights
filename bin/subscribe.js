#!/usr/bin/env node

'use strict'

var DEFAULT_HOST = 'localhost'
var DEFAULT_PORT = 1883
var mqtt = require('mqtt')

var client = mqtt.connect({ port: DEFAULT_PORT, host: DEFAULT_HOST, keepalive: 10000});

client.subscribe('presence')
client.on('message', function (topic, message) {
  console.log(message.toString())
})
