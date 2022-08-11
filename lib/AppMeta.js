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



function AppMeta( params = {} ) {
	if ( ! params || typeof params !== 'object' ) { throw new TypeError( 'AppMeta(): bad params, not an object' ) ; }

	this.targetFileDate = params.targetFileDate instanceof Date ? params.targetFileDate : null ;
	this.targetFileSize = typeof params.targetFileSize === 'number' ? params.targetFileSize : null ;

	this.runCount = params.runCount || 0 ;
	this.totalRunTime = params.totalRunTime || 0 ;	// in seconds

	// Last time the app was running
	this.lastStartTime = params.lastStartTime instanceof Date ? params.lastStartTime : null ;
	this.lastStopTime = params.lastStopTime instanceof Date ? params.lastStopTime : null ;
	this.lastRunTime = params.lastStopTime instanceof Date ? params.lastStopTime : null ;	// in seconds
	this.lastExitCode = params.lastExitCode ?? null ;

	this.lastIconUpdateTime = params.lastIconUpdateTime instanceof Date ? params.lastIconUpdateTime : null ;
}

module.exports = AppMeta ;



AppMeta.prototype.addSession = function( start , stop , exitCode ) {
	this.lastStartTime = new Date( start ) ;
	this.lastStopTime = new Date( stop ) ;
	this.lastRunTime = ( stop - start ) / 1000 ;
	this.lastExitCode = exitCode ;

	this.runCount ++ ;
	this.totalRunTime += this.lastRunTime ;
} ;

