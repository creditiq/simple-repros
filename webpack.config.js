const path = require('path');

require('resolve-url-loader');


function createWebpackConfig({
  production,
  absoluteProjectRootPath,
}) {

  const mode = production ? 'production' : 'development';
  // webpack config object
  const config = {
    mode,
    cache: {
      type: 'filesystem',
      buildDependencies: {
        // This makes all dependencies of this file - build dependencies
        config: [__filename],
        // By default webpack and loaders are build dependencies
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      symlinks: true,
    },
    entry: './src/index',
    target: 'web',
    output: {
      path: path.resolve(__dirname + `/dist`),
      publicPath: '/',
      filename: '[name].[contenthash].bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: {
            loader: 'resolve-url-loader',
            options: {
              sourceMap: false,
            },
          },
        },
      ],
    },
  };
  return config;
}

module.exports = createWebpackConfig;
