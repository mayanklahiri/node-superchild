console.log('This is the multi-line stdout sentinel.\n\rIt spans three lines.\nIt has Unix and DOS line breaks.');
console.log(JSON.stringify(['this', 'is', 'the', 'json_array', 'sentinel']));
console.log(JSON.stringify({sentinel: 'json_object'}));
process.exit(91);
console.log('This string should not make it through.');
