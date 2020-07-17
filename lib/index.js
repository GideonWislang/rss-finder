'use strict';

var htmlParser = require('./parser');
var extend = require('extend');
var Promise = require('pinkie-promise');
var url = require('url');
const fetch = require("node-fetch");

var defaults = {
  feedParserOptions: {}
};

function isRelativeUrl(str) {
  return /^https?:\/\//i.test(str);
}

function setError(err) {
  if (err instanceof Error) {
    return err;
  }

  return new Error(err);
}

function cleanUrl(uri) {
  if (uri[uri.length - 1] === '/') {
    return uri.substr(0, uri.length - 1);
  }

  return uri;
}

function fixData(res, uri) {
  return new Promise(function(resolve) {
    var feedUrl;
    var i = res.feedUrls.length;

    while (i--) {
      feedUrl = res.feedUrls[i];

      if (feedUrl.url) {
        if (!isRelativeUrl(feedUrl.url)) {
          feedUrl.url = url.resolve(uri, feedUrl.url);
        }
      } else {
        feedUrl.url = uri;
      }
    }

    if (!res.site.url) {
      res.site.url = cleanUrl(uri);
    }

    resolve(res)
  });
}

function rssFinder(opts) {
  return new Promise(function(resolve, reject) {
    var o = extend(true, {}, defaults);

    if (typeof opts === 'string') {
      o.url = opts;
    } else if (typeof opts === 'object' && !Array.isArray(opts)) {
      o = extend(true, {}, defaults, opts);
    } else {
      reject(setError('Parameter `opts` must be a string or object.'));
      return;
    }

    if (!isRelativeUrl(o.url)) {
      reject(setError('Not HTTP URL is provided.'));
      return;
    }

    var canonicalUrl;

    fetch(o.url)
      .then(async function(res) {
        canonicalUrl = res.url;
        return {headers: res.headers, body: await res.text()}
      }).then(function(data) {
        return htmlParser(data.headers, data.body, o.feedParserOptions);
      })
      .then(function(res) {
        return fixData(res, canonicalUrl);
      })
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        reject(setError(err));
      });
  });
}

module.exports = rssFinder;
