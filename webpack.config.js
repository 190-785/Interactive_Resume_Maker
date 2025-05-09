const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/js/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true,
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime']
          }
        }
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ['raw-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf|otf|json|fbx|obj)$/,
        type: 'asset/resource',
        generator: {
          filename: '[path][name][ext]'
        }
      }
    ]
  },
  stats: {
    errorDetails: true,
    warningsFilter: /System.import/
  },
  infrastructureLogging: {
    level: 'error'
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/textures',
          to: 'textures/[name][ext]',
          noErrorOnMissing: true
        },
        {
          from: 'src/fonts/**/*',
          to: 'fonts/[name][ext]',
          noErrorOnMissing: true
        },
        {
          from: 'src/index.html',
          to: 'index.html'
        },
        {
          from: '**/*',
          context: 'src/assets',
          to: 'assets/[path][name][ext]',
          noErrorOnMissing: true
        }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
      serveIndex: true,
      watch: true,
    },
    port: 8080,
    open: true,
    hot: true,
    compress: true,
    historyApiFallback: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    },
    allowedHosts: ['.localhost', '127.0.0.1'],
    client: {
      webSocketURL: 'ws://localhost:8080/ws',
      overlay: false
    },
    webSocketServer: {
      type: 'ws',
      options: {
        path: '/ws'
      }
    }
  },
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@textures': path.resolve(__dirname, 'src/textures'),
      '@fonts': path.resolve(__dirname, 'src/fonts'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@js': path.resolve(__dirname, 'src/js')
    }
  },
  performance: {
    hints: false,
    maxEntrypointSize: 1024 * 1024 * 5, // 5MB
    maxAssetSize: 1024 * 1024 * 5       // 5MB
  }
};
