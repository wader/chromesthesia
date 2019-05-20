lint:
	eslint -c src/.eslintrc.json src/*.js

zip:
	git archive -o chromesthesia.zip master:src

