name 'ai-robberies'
author 'TGIANN'
version '0.1.0' -- x-release-please-version
license 'GPL-3.0-only'
description 'Robberies: store registers and safes, bank vaults and lockers, jewelery vitrines'
repository 'https://github.com/aifivem/ai-robberies'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/places.json',
	'data/targets.json',
}
