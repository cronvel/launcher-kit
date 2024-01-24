/*
	Launcher Kit

	Copyright (c) 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;




/*
	This wrapper was done for upgrading the module "open" from v8 to v10, since this module is now ESM-only
	(which makes ZERO sense for a Node.js-only module, but well...).
	But Electronjs does not support ESM until v28 released december 2023.
	But even Electronjs v28 crashes when trying to dynamicly import() "open".

	So... for instance we will be using the older "open" v8.4.2 until it finally works in Electronjs (and there are
	good reasons not to use Electronjs own shell open).

	Or I will forks "open" to turn it into CJS again.
*/

var openCjs ;

async function open_v8_cjs( ... args ) {
	if ( ! openCjs ) { openCjs = require( 'open' ) ; }
	return openCjs( ... args ) ;
}

var openEsmImportPromise , openEsm ;

async function open_v10_esm( ... args ) {
	if ( openEsm ) {
		return openEsm( ... args ) ;
	}

	if ( openEsmImportPromise ) {
		return ( await openEsmImportPromise ).default( ... args ) ;
	}

	openEsmImportPromise = import( 'open' ) ;
	openEsm = ( await openEsmImportPromise ).default ;
	return openEsm( ... args ) ;
}

module.exports = open_v8_cjs ;

