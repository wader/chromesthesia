lint:
	eslint -c src/.eslintrc.json src/*.js

zip:
	(cd src && zip -r ../chromesthesia.zip .)

crx:
	# gem install crxmake
	ruby -rcrxmake -e 'CrxMake.make(:ex_dir => "src", :crx_output => "chromesthesia.crx")'
