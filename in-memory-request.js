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
function its(it, type) {
    return toString.call(it) == '[object ' + type + ']'
}
function Response(cfg) {
    this.url = cfg.url
    this.statusCode = 0
    this.headers = {}
    this.body = undefined
    this.cfg = cfg
    this.response = cfg.response

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
    var data = (its(this.data,'String') ? this.data : JSON.stringify(this.data))
    this.emit('data',data || '')
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
/**
 * Registers an {Expectation} to be asserted upon later
 * @method expect
 * @param {Object} req request : having a `url`, `method`, (optional) headers and (optional) body
 * @param {Object} res response
 * @return {Promise}
 * */
InMemoryHttp.prototype.expect = function(req,res) {
    var cfg = {
        request: req
        ,response: res
    }
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
InMemoryHttp.prototype.invocation = function(cfg, resolve, reject) {
    return this.invoke(cfg).
        then(function(message){
        console.log('invoked',message, resolve.toString())
            return resolve(message.response)
        },reject)
}
/**
 * Queues an `invoke` method for later `flush`
 * @method enqueue
 * @return {Promise} resolving `this`
 * */
InMemoryHttp.prototype.enqueue = function(cfg) {
    var p = new Promise(function(resolve, reject){
        this.invocations.push(this.invocation.bind(this,cfg, resolve, reject))
    }.bind(this))
    return p
}
/**
 * Executes request against the next expectation,
 * rejecting with appropriate `Error`, or resolving if matching
 * @method invoke
 * @param {Object} cfg The request to invoke
 * @return {Promise}
 * */
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
        try {
            req.flush()
        } catch(err) {
            reject(err)
        }
    }.bind(this))
}
/**
 * Invokes any queued invocations
 * @method flush
 * @return {Promise}
 * */
InMemoryHttp.prototype.flush = function(cfg) {
    var p = Promise.resolve(this)
    return serial.call(this,p,this.invocations)
}
/**
 * Convenience method for printing out expectations
 * @method printExpectations
 * @return {String} of \n delimited expectation output
 * */
InMemoryHttp.prototype.printExpectations = function(){
    var expect = this.expectations.map(function(ex){
        return ex.toString()
    },this)
    var bullet = '\u25B8 '
    return bullet + expect.join('\n' + bullet)

}
/**
 * Verifies that all expectations have been met,
 * rejecting if any remain; otherwise, resolve `this`
 * @method verify
 * @return {Promise}
 * */
InMemoryHttp.prototype.verify = function() {
    var msg = util.format('There are %s requests pending:\n%s',this.expectations.length, this.printExpectations())
    if(this.expectations.length) {
        return Promise.reject(new Error(msg))
    }
    return Promise.resolve(this)
}
module.exports = InMemoryHttp
