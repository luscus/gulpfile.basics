/* jshint node:true */
/* jshint expr:true*/
/* global require */
/* global process */
/* global describe */
/* global after */
/* global it */
'use strict';

require('chai').should();
var expect = require('chai').expect;

var assert  = require("assert");
var gulp    = require('../lib/gulpfile.basics');
var pathLib = require('path');
var root    = require('package.root');

// get the package's parent directory
var PARENT  = root.path.substring(0,root.path.lastIndexOf(pathLib.sep)) + pathLib.sep;


console.log(JSON.stringify(gulp,null,2));

// TODO write tests