lint:
	eslint -c src/.eslintrc.json src/*.js

zip:
	git archive -o chromesthesia.zip master:src

crx:
	# gem install crxmake
	ruby -rcrxmake -e 'CrxMake.make(:ex_dir => "src", :crx_output => "chromesthesia.crx")'
