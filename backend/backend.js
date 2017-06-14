// content of index.js
const http = require('http')  
const port = 3000

const requestHandler = (request, response) => {  
  console.log(request.url)
  response.end('Hello Node.js Server!')
}

///////////////////////////////

var backend = function () {};

backend.prototype.start = function () {
  console.log('buz!');

  const server = http.createServer(requestHandler)

  server.listen(port, (err) => {  
    if (err) {
      return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
  })
};

module.exports = new backend();