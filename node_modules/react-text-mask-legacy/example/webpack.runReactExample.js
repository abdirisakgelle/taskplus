const path = require('path')
require('webpack')
const coreLoaders = require('../../core/webpack.buildCore.js').module.rules

module.exports = {
  mode: 'development',
  devtool: 'eval',
  entry: [
    path.join(__dirname, '/index.js')
  ],
  output: {
    path: path.join(__dirname, '/'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  resolve: {
    extensions: ['', '.js', '.jsx']
  },
  module: {
    rules: [{
      test: /\.jsx?$/,
      use: [
        'react-hot-loader/webpack',
        {
          loader: 'babel-loader',
          options: {
            plugins: ['react-hot-loader/babel'],
            rootMode: 'upward'
          }
        }
      ],
      include: [
        __dirname,
        path.join(__dirname, '../src'),
        path.join(__dirname, '../../core/src')
      ]
    }].concat(coreLoaders)
  }
}
