//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js context
  mode: 'none', // Keep the source code as close to the original for easier debugging

  entry: './src/extension.ts', // Entry point for the VS Code extension
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: 'extension.js',
    libraryTarget: 'commonjs2' // Required for VS Code extensions
  },
  externals: {
    vscode: 'commonjs vscode' // Exclude the vscode module
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'], // Support TS, TSX, and JS files
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Match both .ts and .tsx files
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true // Speed up build times by skipping type checking
            }
          }
        ]
      },
      {
        test: /\.css$/, // Match CSS files for Webview front-end
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'nosources-source-map', // Generate source maps without exposing code
  infrastructureLogging: {
    level: 'log', // Enable logging for debugging build process
  },
};

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web', // Target for Webview front-end code
  mode: 'none',

  entry: './src/html/index.tsx', // Entry point for Webview front-end
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    libraryTarget: 'umd', // Universal Module Definition for compatibility
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Match TS and TSX files
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          }
        ]
      },
      {
        test: /\.css$/, // Process CSS files
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'source-map', // Enable source maps for debugging in Webview
};

/** @type WebpackConfig */
const glPreviewConfig = {
  target: 'web', // Target for Webview front-end code
  mode: 'none',

  entry: './src/webview/gl_preview/gl_preview.tsx', // Entry point for Webview front-end (JS file)
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'gl_preview.tsx',
    libraryTarget: 'umd', // Universal Module Definition for compatibility
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/, // Match TS and TSX files
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          }
        ]
      },
      {
        test: /\.css$/, // Process CSS files
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'source-map', // Enable source maps for debugging in Webview






  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: './src/webview/gl_preview/gl_preview.html', to: './gl_preview.html' }, // 复制 HTML 文件到 dist
        // { from: 'src/public', to: 'public' }, // 也可以复制整个目录
      ],
    }),
  ],
};


module.exports = [extensionConfig, webviewConfig, glPreviewConfig];