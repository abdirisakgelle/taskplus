require('webpack')
const path = require('path')

module.exports = {
  entry: path.join(__dirname, './src/reactTextMask.js'),

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        options: {
          rootMode: 'upward'
        }
      }
    ]
  },

  output: {
    path: path.join(__dirname, './dist'),
    filename: 'reactTextMask.js',
    library: {
      name: 'reactTextMask',
      type: 'umd'
    }
  },

  resolve: {
    extensions: ['.jsx', '.js']
  },

  externals: [
    {
      react: {
        root: 'React',
        commonjs2: 'react',
        commonjs: 'react',
        amd: 'react'
      }
    }
  ]
}
