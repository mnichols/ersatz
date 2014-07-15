'use strict';

var InMemory = require('..').InMemory
describe('InMemoryRequest',function(){
    function copy(src,dest) {
        dest = dest || {}
        for(var k in src) {
            dest[k] = src[k]
        }
        return dest
    }
    var request
        ,fixtures
    beforeEach(function(){
        request = new InMemory()
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
                    ,body: JSON.stringify({ name: 'x'})
                    ,headers: {
                        'content-type': 'application/hal+json'
                    }
                }
            }
        }
    })
    describe('when at least one expected request has not been made',function(){
        beforeEach(function(){
            return request.expect(fixtures.a.request, fixtures.a.response)
        })
        it('should reject the flush',function(){
            return request.flush()
                .then(request.verify.bind(request))
                .should.be.rejectedWith(/There are 1 requests pending/)
        })
    })
    describe('when printing',function(){
        it('should list expectations',function(){
            request.expect(fixtures.a.request,fixtures.a.response)
            request.expect(fixtures.x.request,fixtures.x.response)
            console.log(request.printExpectations())
        })
    })
    describe('when all expected requests have been made',function(){
        beforeEach(function(){
            return request.expect(fixtures.a.request, fixtures.a.response)
        })
        beforeEach(function(){
            return request.invoke(fixtures.a.request)
        })
        it('should do nothing on flush',function(){
            return request.flush()
                .then(request.verify)
                .should.be.ok
        })
    })

    describe('when queued invocations fail upon flush',function(){
        beforeEach(function(){
            request.expect(fixtures.x.request,fixtures.x.response)
        })
        beforeEach(function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return request.enqueue(req).should.be.ok
        })
        it('should be rejected',function(){
            return request.flush()
                .should
                .be.rejectedWith(/Expected request on url \/x, but got \/bad-url/)
        })
    })
    describe('when queued invocations are not flushed',function(){
        beforeEach(function(){
            request.expect(fixtures.x.request,fixtures.x.response)
        })
        beforeEach(function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return request.enqueue(req).should.be.ok
        })
        it('should be rejected',function(){
            return request.verify()
                .should
                .be.rejectedWith(/There are 1 requests pending:/)
        })
    })
    describe('when request is made not meeting expectation',function(){
        beforeEach(function(){
            return request.expect(fixtures.x.request,fixtures.x.response)
        })
        it('should reject when wrong url',function(){
            var req = copy(fixtures.x.request)
            req.url = '/bad-url'
            return request.invoke(req).should
                .be.rejectedWith(/Expected request on url \/x, but got \/bad-url/)
        })
        it('should reject when wrong method',function(){
            var req = copy(fixtures.x.request)
            req.method = 'GET'
            return request.invoke(req).should
                .be.rejectedWith(/Expected request on \/x with method POST, but got method GET/)
        })
        it('should reject when wrong body',function(){
            var req = copy(fixtures.x.request)
            req.body = JSON.stringify({name: 'FAIL'})
            return request.invoke(req).should
                .be.rejectedWith(/Expected request on \/x with body {"name":"x"}, but got {"name":"FAIL"}/)

        })
        it('should reject when wrong headers',function(){
            var req = copy(fixtures.x.request)
            req.headers = { 'accept':'text/plain'}
            return request.invoke(req).should
            .be.rejectedWith(/Expected request on \/x to have header accept with value application\/hal\+json/)
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
