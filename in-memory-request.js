'use strict';

var Expectation = require('./expectation')
    ,Promise = require('es6-promise').Promise
    ,util = require('util')
    ,EventEmitter  = require('events').EventEmitter
    ;

function serial(promise, invocations) {
    if(!invocations.length) {
        return promise
    }
    var invocation = invocations.shift()
    var result = invocation.call(this)
    return result.then(serial.bind(this,result,invocations))
}
function Response(cfg) {
    this.url = cfg.url
    this.statusCode = 0
    this.headers = {}
    this.body = undefined
    this.cfg = cfg

}
Response.prototype.setHeader = function(k,v) {
    this.headers[k] = v
}
Response.prototype.write = function(val) {
    this.body = val
}
Response.prototype.end = function(){
    this.ended = true
}

function Request(cfg) {
    EventEmitter.call(this)
    this.url = cfg.url
    this.headers = cfg.headers
    this.method = cfg.method
    this.data  = cfg.body
}
Request.prototype = new EventEmitter
Request.prototype.flush = function(){
    this.emit('data',this.data || '')
    this.emit('end')
}

function InMemoryHttp(cfg){
    this.cfg= cfg || {}
    this.expectations= []
    this.invocations = []
    this.verify = this.verify.bind(this)
    this.enqueue = this.enqueue.bind(this)
    this.flush = this.flush.bind(this)
    this.printExpectations = this.printExpectations.bind(this)
    this.invoke = this.invoke.bind(this)

}
InMemoryHttp.prototype.expect = function(cfg) {
    return new Promise(function(resolve, reject) {
        var it
        try {
            it = new Expectation(cfg, {
                respondFailures: this.cfg.respondFailures
            })
            this.expectations.push(it)
        } catch(err) {
            return reject(err)
        }
        return resolve(it)
    }.bind(this))
}
InMemoryHttp.prototype.enqueue = function(cfg) {
    this.invocations.push(this.invoke.bind(this,cfg))
    return Promise.resolve(this)
}
InMemoryHttp.prototype.invoke = function(cfg) {
    return new Promise(function(resolve, reject){

        var expectation = this.expectations.shift()

        if(!expectation) {
            var msg = util.format('Unknown request for %s with method %s',req.url,req.method)
            reject(new Error(msg))
        }
        var req = new Request(cfg)
            ,res = new Response(expectation.cfg)
        expectation.match(req, res).then(resolve.bind(res,res),reject)
        req.flush()
    }.bind(this))
}
InMemoryHttp.prototype.flush = function(cfg) {
    var p = Promise.resolve(function(){

    })
    return serial(p,this.invocations)

}
InMemoryHttp.prototype.printExpectations = function(){
    var expect = this.expectations.map(function(ex){
        return ex.toString()
    },this)
    var bullet = '\u25B8 '
    return bullet + expect.join('\n' + bullet)

}
InMemoryHttp.prototype.verify = function() {
    var msg = util.format('There are %s requests pending:\n%s',this.expectations.length, this.printExpectations())
    if(this.expectations.length) {
        return Promise.reject(new Error(msg))
    }
    return Promise.resolve(this)
}
module.exports = InMemoryHttp
