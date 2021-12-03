const express = require('express')
const path = require('path')

const app = express()

const port = process.env.PORT || 5000
// setup static and middleware
app.use(express.static('./public'));

// app.get('/', (req, res) => {
//   res.sendFile(path.resolve(__dirname, './navbar-app/index.html'))
//   adding to static assets
//   SSR
// })

app.all('*', function (request, response) {
    response.status(404).send('Resource Not Found')
})

app.listen(port, function () {
    console.log(`Server is listening on port ${port}....`)
})