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



const BaseLauncher = require( './BaseLauncher.js' ) ;
const utils = require( './utils.js' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const path = require( 'path' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function RomLauncher( launcherKit , params = {} , appConfigPath = null ) {
	BaseLauncher.call( this , launcherKit , params , appConfigPath ) ;

	this.rom = params.rom ;	// rom path
	this.emulatorExe = params.emulatorExe ;	// emulator path

	this.directory = params.directory ;    // Working directory
	this.addCtx( 'wdir' , () => utils.fixPath( Dynamic.getSafeFinalValue( this.directory , this.ctx ) , this.launcherKit.homeDir ) ) ;

	[ 'rom' , 'emulatorExe' , 'directory' ].forEach( key => this.savedProperties.add( key ) ) ;

	this.schema.properties.rom = { type: 'string' , input: { method: 'fileSelector' , label: 'rom' } } ;
	this.schema.properties.emulatorExe = { type: 'string' , input: { method: 'fileSelector' , label: 'emulator executable' } } ;
	this.schema.properties.directory = { type: 'string' , input: { method: 'directorySelector' , label: 'directory' } } ;
}

RomLauncher.prototype = Object.create( BaseLauncher.prototype ) ;
RomLauncher.prototype.constructor = RomLauncher ;

module.exports = RomLauncher ;



RomLauncher.prototype.isRom = true ;
RomLauncher.prototype.mainFileProperty = 'rom' ;



RomLauncher.prototype.buildSpawnOptions = function() {
	var wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.emulatorExe , this.ctx ) , wdir , true ) ,
		args = [ Dynamic.getSafeFinalValue( this.rom , this.ctx ) ] ;

	return { exe ,
		args ,
		options: {
			detached: true ,
			cwd: wdir ?? undefined
		} } ;
} ;

