'use strict';

var InMemory = require('..').InMemory
    ,Promise = require('es6-promise').Promise
    ,util = require('util')
    ,deepEqual = require('deep-equal')
describe('InMemoryRequest',function(){
    function copy(src,dest) {
        dest = dest || {}
        for(var k in src) {
            dest[k] = src[k]
        }
        return dest
    }
    var request
        ,ersatz
        ,fixtures
    beforeEach(function(){
        request = new InMemory()
        ersatz = new Ersatz()
    })
    beforeEach(function(){
        fixtures = {
            a: {
                request : {
                    url: '/a'
                    ,method: 'GET'
                    ,headers: {
                        'accept': 'application/hal+json'
                    }
                }
                ,response: {
                    statusCode: 200
                    ,headers: {
                        'content-type':'application/json'
                    }
                    ,body: JSON.stringify({name:'a'})
                }
            }
            ,c: {
                request: {
                    url: '/c'
                    ,method: 'GET'
                }
                ,response: {
                    statusCode: 200
                    ,headers: {
                        'content-type':'application/json'
                    }
                    ,body: ''
                }
            }
            ,x: {
                request: {
                    url: '/x'
                    ,method: 'POST'
                    ,headers: {
                        'accept': 'application/hal+json'
                        ,'x-foo': 'bar'
                    }
                    ,body: {name: 'x'}
                }
                ,response: {
                    statusCode: 200
                    ,body: { name: 'x'}
                    ,headers: {
                        'content-type': 'application/hal+json'
                    }
                }
            }
        }
    })
    function Expectation(req, res) {
        this.req = req
        this.res = res
        if(!this.req.url) {
            throw new Error('url is required for expectation')
        }
        if(!this.req.method) {
            throw new Error('method is required for expectation')
        }
    }
    Expectation.prototype.match = function(req) {
        var matchers = [
            this.matchUrl
            ,this.matchMethod
            ,this.matchHeaders
            ,this.matchBody
        ]
        var promises = matchers.map(function(m){
            return m.call(this,req)
        },this)
        return Promise.all(promises)
    }
    Expectation.prototype.matchUrl = function(req) {
        var msg = 'Expected request for %s, but got %s'
        if(req.url === this.req.url) {
            return Promise.resolve(this.res)
        }
        var err = new Error(util.format(msg,this.req.url,req.url))
        return Promise.reject(err)
    }
    Expectation.prototype.matchMethod = function(req) {
        var msg = 'Expected request for %s with method %s, but got method %s'
        if(req.method.toLowerCase() === this.req.method.toLowerCase()){
            return Promise.resolve(this.res)
        }

        var err = new Error(util.format(msg,this.req.url,this.req.method,req.method))
        return Promise.reject(err)
    }
    Expectation.prototype.matchBody = function(req) {
        var expectBody = this.req.body
            , actualBody = req.body
        if(deepEqual(expectBody,actualBody)) {
            return Promise.resolve(this.res)
        }
        var msg = util.format('Expected request for %s to have body %s, but got %s',
                     this.req.url,JSON.stringify(expectBody,undefined,2),JSON.stringify(actualBody,undefined,2))
        return Promise.reject(new Error(msg))

    }
    Expectation.prototype.matchHeaders = function(req) {
        var expectHeaders = this.req.headers || {}
            ,actualHeaders = req.headers || {}
        ;

        for(var k in expectHeaders) {
            var key = k.toLowerCase()
            var actual = actualHeaders[key]
            if(actual !== expectHeaders[key]) {
                var msg = util.format('Expected request for %s to have header %s with value %s'
                    ,this.req.url,k,expectHeaders[k])
                var err = new Error(msg)
                return Promise.reject(err)
            }
        }
        return Promise.resolve(this.res)

    }

    Expectation.prototype.toString = function(){
        return util.format('%s %s, body: %s, headers: %s'
            , this.req.method
            , this.req.url
            , JSON.stringify(this.req.headers)
            , JSON.stringify(this.req.body))
    }
    function Ersatz() {
        this.invocations = []
        this.expectations = []
        this.expect= this.expect.bind(this)
        this.invoke = this.invoke.bind(this)
        this.flush= this.flush.bind(this)
        this.verify = this.verify.bind(this)
    }
    Ersatz.prototype.expect = function(req, res) {
        this.expectations.push(new Expectation(req,res))
    }
    Ersatz.prototype.match = function(req, expectation) {
        var expected = expectation.request || {}
        var urlMsg = 'Expected request for %s, but got %s'
        if(req.url !== expectation.request.url) {
            throw new Error(util.format(urlMsg,req.url,expected.url))
        }

    }
    Ersatz.prototype.invoke = function(req,resolve,reject) {
        resolve = (resolve || Promise.resolve.bind(Promise))
        reject = (reject || Promise.reject.bind(Promise))
        var expectation = this.expectations.shift()
        if(!expectation){
            return reject(new Error('Unexpected request:' + JSON.stringify(req)))
        }
        return expectation.match(req)
            .then(function(res){
                return resolve(expectation.res)
            })
    }
    Ersatz.prototype.enqueue = function(req) {
        return new Promise(function(resolve,reject){
            return this.invocations.push(this.invoke.bind(this,req,resolve,reject))
        }.bind(this))
    }
    Ersatz.prototype.verify = function(){
        if(this.expectations.length) {
            var msg = util.format('There are %s pending requests:\n%s'
                ,this.expectations.length
                ,this.printExpectations())
            return Promise.reject(new Error(msg))
        }
    }
    Ersatz.prototype.flush = function(){
        var p = Promise.resolve(this)
        this.invocations.forEach(function(invoke){
            p = p.then(invoke)
        },this)
        return p
    }
    /**
     * Convenience method for printing out expectations
     * @method printExpectations
     * @return {String} of \n delimited expectation output
     * */
    Ersatz.prototype.printExpectations = function(){
        var expect = this.expectations.map(function(ex){
            return ex.toString()
        },this)
        var bullet = '\u25B8 '
        return bullet + expect.join('\n' + bullet)

    }
    describe('when queuing requests',function(){
        it('should resolve their responses',function(){
            var a,x;
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.enqueue(fixtures.a.request)
                .then(function(res){
                    a = res
                })
            ersatz.enqueue(fixtures.x.request)
                .then(function(res) {
                    x = res
                })
            return ersatz.flush()
                .then(function(){
                    a.body.should.eql(fixtures.a.response.body)
                    x.body.should.eql(fixtures.x.response.body)
                }).should.be.ok
        })
    })
    describe('when at least one expected request has not been made',function(){
        beforeEach(function(){

            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        it('should reject the flush',function(){
            return ersatz.flush()
                .then(ersatz.verify)
                .should.be.rejectedWith(/There are 1 pending requests/)
        })
    })
    describe('when printing',function(){
        it('should list expectations',function(){
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.expect(fixtures.c.request,fixtures.c.response)
            console.log(ersatz.printExpectations())
        })
    })
    describe('when all expected requests have been made',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.a.request, fixtures.a.response)
        })
        beforeEach(function(){
            return ersatz.invoke(fixtures.a.request)
        })
        it('should do nothing on flush',function(){
            return ersatz.flush()
                .then(ersatz.verify)
                .should.be.ok
        })
    })

    describe('when queued invocations fail upon flush',function(){
        beforeEach(function(){
            ersatz.expect(fixtures.a.request,fixtures.a.response)
            ersatz.expect(fixtures.x.request,fixtures.x.response)
            ersatz.expect(fixtures.c.request,fixtures.c.response)
        })
        beforeEach(function(){
            var bad = copy(fixtures.x.request)
            bad.url = '/bad-url'
            ersatz.enqueue(fixtures.a.request)
            ersatz.enqueue(bad)
        })
        it('should be rejected',function(){
            return ersatz.flush()
                .should
                .be.rejectedWith(/Expected request for \/x, but got \/bad-url/)
        })
    })
    describe('when queued invocations are not flushed',function(){
        beforeEach(function(){
            ersatz.expect(fixtures.x.request,fixtures.x.response)
        })
        beforeEach(function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return ersatz.enqueue(req).should.be.ok
        })
        it('should be rejected',function(){
            return ersatz.verify()
                .should
                .be.rejectedWith(/There are 1 pending requests:/)
        })
    })
    describe('when request is made not meeting expectation',function(){
        beforeEach(function(){
            return ersatz.expect(fixtures.x.request,fixtures.x.response)
        })
        it('should reject when wrong url',function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x, but got \/bad-url/)
        })
        it('should reject when wrong method',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x with method POST, but got method GET/)
        })
        it.only('should reject when wrong body',function(){
            var req = copy(fixtures.x.request)
            req.body = {name: 'FAIL'}
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x to have body {\n  "name": "x"\n}, but got {\n  "name": "FAIL"\n}/)

        })
        it('should reject when wrong headers',function(){
            var req = copy(fixtures.x.request)
            req.headers = { 'accept':'text/plain'}
            return ersatz.invoke(req).should
                .be.rejectedWith(/Expected request for \/x to have header accept with value application\/hal\+json/)
        })
        it('should respond when all is matching',function(){
            var req = copy(fixtures.x.request)
            return ersatz.invoke(req)
                .should.eventually.deep.equal(fixtures.x.response)
        })

    })
    describe('when chaining all the things',function(){
        it('should fail as expected',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return request.expect(fixtures.x.request, fixtures.x.response)
                .then(request.enqueue(req))
                .then(request.flush)
                .should
                .be.rejectedWith(/Expected request on \/x with method POST, but got method GET/)
        })

    })

})
