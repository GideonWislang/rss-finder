'use strict';

var htmlparser = require('htmlparser2');
var FeedParser = require('feedparser');
var Promise = require('pinkie-promise');
const fetch = require("node-fetch");

var rssTypes = [
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss',
  'application/atom',
  'application/rdf',
  'text/rss+xml',
  'text/atom+xml',
  'text/rdf+xml',
  'text/xml',
  'text/rss',
  'text/atom',
  'text/rdf'
];

function htmlParser(headers, htmlBody, feedParserOptions) {
  return new Promise(async function(resolve, reject) {
    var rs = {};
    var feeds = [];
    var parser;
    var isFeeds;
    var isSiteTitle;
    var siteTitle;
    var feedParser;

    const parserOptions = {
      onopentag: function(name, attr) {
        if (!isFeeds && name === 'link' && rssTypes.includes(attr.type) && attr.href) {
          feeds.push({
            title: attr.title || null,
            url: attr.href
          });
        }

        if (name === 'title') {
          isSiteTitle = true;
        }
      },

      ontext: function(text) {
        if (isSiteTitle && !siteTitle) {
          siteTitle = text;
        }
      },

      onclosetag: function(name) {
        if (name === 'title') {
          isSiteTitle = false;
        }
      }
    }
    
    // Check if URL is RSS URL
    isFeeds = rssTypes.includes(headers.get('content-type').split(";")[0]);
    if (isFeeds) {
      feedParser = new FeedParser(feedParserOptions);
      feeds = [];

      feedParser.on('error', function(err) {
        reject(err);
      });

      feedParser.on('readable', function() {
        var data;
        if (feeds.length === 0) {
          data = this.meta;
          feeds.push(data);
        }        
      });

      feedParser.write(htmlBody);

      feedParser.end(function() {
        if (feeds.length !== 0) {
          rs.site = {
            title: feeds[0].title || null,
            image: (feeds[0].image||{}).url || null,
            url: feeds[0].link || null
          };

          rs.feedUrls = [{
            title: feeds[0].title || null,
            url: feeds[0].xmlUrl || null
          }];
        }

        // Change Site Title to Blog url title not RSS url title
        fetch(feeds[0].link).then(siteRes=>{
          return siteRes.text()
        }).then(siteHtmlBody=>{
          parser = new htmlparser.Parser(parserOptions, {
            recognizeCDATA: true
          });
          parser.write(siteHtmlBody);
          parser.end();

          if(!!siteTitle){
            rs.site.title = siteTitle
          }

          resolve(rs);
        })

      });
    } else {

      parser = new htmlparser.Parser(parserOptions, {
        recognizeCDATA: true
      });
      parser.write(htmlBody);
      parser.end();

      rs.site = {
        title: siteTitle || null,
      };

      rs.feedUrls = feeds;

      if(!!rs.feedUrls[0]){
        let data = {};
        
        feedParser = new FeedParser(feedParserOptions);

        feedParser.on('error', function(err) {
          reject(err);
        });

        feedParser.on('readable', function() {
              data = this.meta; 
          });

          fetch(rs.feedUrls[0].url).then(siteRes=>{
            return siteRes.text()
          }).then(siteHtmlBody=>{
            
            feedParser.write(siteHtmlBody);
            rs.site.image = (data.image||{}).url || null

            resolve(rs)
          })
      }else{
        resolve(rs);
      }
    }
  });
}

module.exports = htmlParser;
