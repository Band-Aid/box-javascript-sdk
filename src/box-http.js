'use strict';
import "whatwg-fetch";

export default function BoxHttp(options) {
  if (options.upload) {
    // Workaround for upload with Fetch library for now...
    // https://github.com/whatwg/fetch/issues/380
    return new Promise((resolve, reject) => {
      let client = new XMLHttpRequest();
      let uri = options.url;
      let method = options.method;

      client.open(method, uri, true);
      if (options.headers) {
        if (options.headers["Content-Type"]) {
          delete options.headers["Content-Type"];
        }
        Object.keys(options.headers).forEach((key) => {
          client.setRequestHeader(key, options.headers[key]);
        });
      }
      client.send(options.body);
      client.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(JSON.parse(this.response));
        } else {
          var error = new Error(this.statusText);
          let responseText;
          if (this.response) {
            try {
              responseText = JSON.parse(this.response);
            } catch (e) {
              responseText = this.response
            }
          } else {
            responseText = {};
          }
          error.response = responseText;
          reject(error);
        }
      }
      client.onerror = function () {
        var error = new Error(this.statusText);
        let responseText;
        if (this.response) {
          try {
            responseText = JSON.parse(this.response);
          } catch (e) {
            responseText = this.response
          }
        } else {
          responseText = {};
        }
        error.response = responseText;
        reject(error);
      }
    });
    // Workaround for cancelling requests with Fetch library for now...
    // https://github.com/whatwg/fetch/issues/380  
  } else if (!options.useXHR && window && window.fetch) {
    return fetch(options.url, options)
      .then(handleErrors)
      .then(constructResponse, options);
  }
  else {
    let client = new XMLHttpRequest();
    let request = new Promise((resolve, reject) => {
      let uri = options.url;
      let method = options.method;

      client.open(method, uri, true);
      Object.keys(options.headers).forEach((key) => {
        client.setRequestHeader(key, options.headers[key]);
      });
      client.send(options.body);
      client.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          let returnData = (this.response) ? JSON.parse(this.response) : {};
          let headers;
          try {
            headers = parseXHRHeaders(client.getAllResponseHeaders());
          } catch (e) {
            headers = client.getAllResponseHeaders();
          }
          let builtResponse = {
            data: returnData,
            headers: headers,
            status: this.status
          }
          resolve(constructResponse(builtResponse, options));
        } else {
          var error = new Error(this.statusText);
          error.status = this.status;
          let responseText;
          if (this.response) {
            try {
              responseText = JSON.parse(this.response);
            } catch (e) {
              responseText = this.response
            }
          } else {
            responseText = {};
          }
          error.response = responseText;
          reject(error);
        }
      }
      client.onerror = function () {
        let error;
        if (this.statusText) {
          error = new Error(this.statusText);
        } else {
          error = new Error("Unknown");
        }
        let responseText;
        if (this.response) {
          try {
            responseText = JSON.parse(this.response);
          } catch (e) {
            responseText = this.response
          }
        } else {
          responseText = {};
        }
        error.response = responseText;
        reject(error);
      }
    });
    if (options.returnCancelToken) {
      function abort() {
        client.abort();
      }
      return {
        promise: request,
        abort: abort
      };
    } else {
      return request;
    }
  }
  function handleErrors(response) {
    if (!response.ok) {
      var error = new Error(response.statusText);
      if (response)
        return response.json().catch(() => { return {}; })
          .then((body) => {
            error.response = {};
            if (Object.keys(body).length === 0) {
              error.response = response
            } else {
              error.response = body;
            }
            throw error;
          })

    }
    return response;
  }

  function constructResponse(response, options) {
    if (options && options.includeFullResponse) {
      if (response.data && response.headers && response.status) {
        return new Promise(function (resolve, reject) {
          resolve(response);
        });
      }
      let buildResponse = {
        data: {},
        headers: {},
        status: ""
      };
      return new Promise(function (resolve, reject) {
        buildResponse.headers = response.headers;
        buildResponse.status = response.status;
        if (checkForJSONResponse(response)) {
          return response.json().catch(() => { return {}; })
            .then(function (body) {
              buildResponse.data = body;
              resolve(buildResponse);
            })
        } else if (checkForDataResponse(response)) {
          return new Promise(function (resolve, reject) {
            buildResponse.data = response.data;
            resolve(buildResponse);
          });
        } else {
          resolve(buildResponse);
        }
      });
    } else {
      if (checkForJSONResponse(response)) {
        return response.json().catch(() => { return {}; });
      } else if (checkForDataResponse(response)) {
        return new Promise(function (resolve, reject) {
          resolve(response.data);
        });
      } else {
        return new Promise(function (resolve, reject) {
          resolve({});
        });
      }
    }
  }

  function parseXHRHeaders(headerStr) {
    var headers = {};
    if (!headerStr) {
      return headers;
    }
    var headerPairs = headerStr.split('\u000d\u000a');
    for (var i = 0; i < headerPairs.length; i++) {
      var headerPair = headerPairs[i];
      var index = headerPair.indexOf('\u003a\u0020');
      if (index > 0) {
        var key = headerPair.substring(0, index).toLowerCase();
        var val = headerPair.substring(index + 2);
        headers[key] = val;
      }
    }
    return headers;
  }

  function checkForJSONResponse(response) {
    return (response.json && typeof response.json === 'function') ? true : false;
  }
  function checkForDataResponse(response) {
    return (response.data && typeof response.data === 'object') ? true : false;
  }
}
