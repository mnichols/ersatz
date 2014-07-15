'use strict';

var Expectation = require('./expectation')
    ,Promise = require('es6-promise').Promise
    ,util = require('util')
    ,EventEmitter  = require('events').EventEmitter
    ;

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
    this.verify = this.verify.bind(this)

}
InMemoryHttp.prototype.expect = function(cfg) {
    return new Promise(function(resolve, reject) {
        var it
        try {
            it = new Expectation(cfg)
            this.expectations.push(it)
        } catch(err) {
            return reject(err)
        }
        return resolve(it)
    }.bind(this))
}
InMemoryHttp.prototype.invoke = function(cfg) {
    cfg.url = (cfg.url || this.url(cfg))
    if(!cfg.body) {
        cfg.body = (cfg.data ? JSON.stringify(cfg.data) : undefined)
    }
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
    //verify expectations
    return Promise.resolve(this)

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
