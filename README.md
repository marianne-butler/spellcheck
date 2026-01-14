# Spellcheck Demo Notes

I used vanilla javascript to try to keep it simple and it’s compiled using `parcel`. 

To run and view the app
In the base directory, run:

npm install
npm start

> http://localhost:1234/


Notes on implementation
1) I had issues loading the dictionaries from npm packages, so in order to save dev time, I loaded via them CDN. This makes the UI slow to start, so it would definitely not be the solution I’d want to take for a user facing product. The UI is disabled via css until the dictionary files are loaded.

2) I tried to implement spell check only on the “current word” (the word where the cursor is), because it felt like a lot to spell check the whole document on each update. This lead to 2 issues which I didn’t have time to resolve.
  _a) When you switch language, the state of existing nodes (with or without error marking) is not updated. 
  _b) Sometimes when editing words which are not at the end of paragraphs, part of the error marking is not updated. 


