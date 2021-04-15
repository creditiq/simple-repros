const path = require('path');

const webpack = require('webpack');
const autoprefixer = require('autoprefixer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const DuplicatePackageCheckerPlugin = require('duplicate-package-checker-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const TerserPlugin = require('terser-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');

const _ = require('lodash');

const smp = new SpeedMeasurePlugin();

const DEFAULT_GLOBAL_SCSS_PATHS = ['grid', 'global', 'toastr', 'piller'];
module.exports.DEFAULT_GLOBAL_SCSS_PATHS = DEFAULT_GLOBAL_SCSS_PATHS;

function createWebpackConfig({
  production,
  absoluteProjectRootPath,
  favicon,
  getApiStageVariables = () => ({}),
  globalScssPaths = DEFAULT_GLOBAL_SCSS_PATHS,
  extractCSS,
  devPort = 8000,
}) {
  console.log('absolute path', absoluteProjectRootPath);
  const stageSettingsEnv = _.pick(
    process.env,
    'CIQ_API_STAGE',
    'CIQ_LOCAL_BACKEND',
    'CIQ_LOCAL_SOCKET',
    'CIQ_LOCAL_CHECKOUT',
    'CIQ_TEST_PROD_BUILD'
  );
  console.log('stageSettings', JSON.stringify(stageSettingsEnv, null, 2));

  const _apiStage = stageSettingsEnv.CIQ_API_STAGE;
  const isApiStageLocal = _apiStage === 'local';
  const apiStage = !_apiStage || isApiStageLocal ? 'dev' : _apiStage;
  const localBackend = (!production && !!stageSettingsEnv.CIQ_LOCAL_BACKEND) || !!isApiStageLocal;
  const localSocket = !production && !!stageSettingsEnv.CIQ_LOCAL_SOCKET;
  const localCheckout = !production && !!stageSettingsEnv.CIQ_LOCAL_CHECKOUT;
  const testProductionBuildWithDevServer = !!stageSettingsEnv.CIQ_TEST_PROD_BUILD;
  production = production || testProductionBuildWithDevServer;
  extractCSS = extractCSS || !!production;

  const useDevServer = !production || testProductionBuildWithDevServer;

  const globalSassRegex = new RegExp(`(${globalScssPaths.join('|')})\\.scss$`);
  const useSourceMaps = false; // could make this !production if we want it in dev
  const entry = './dist/index';

  const output = {
    path: path.resolve(absoluteProjectRootPath + `/dist/main`),
    publicPath: '/',
    filename: useDevServer ? '[name].bundle.js' : '[name].[contenthash].bundle.js',
  };

  const apiStageVariables = getApiStageVariables(production, { apiStage, localBackend, localSocket, localCheckout });
  const definePluginGlobals = _.mapValues(
    {
      __DEV__: !production,
      'process.env.NODE_DEBUG': process.env.NODE_DEBUG,
      'process.type': process.type,
      'process.version': process.version,
      ...apiStageVariables,
    },
    // auto stringify all strings, if for some horrible reason we wanted to insert a genuine code token we can override... but let's not do that
    (v) => (_.isString(v) ? JSON.stringify(v) : v)
  );
  const plugins = [
    // !production && new BundleAnalyzerPlugin() || (() => {}),
    // new DuplicatePackageCheckerPlugin(),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),

    new webpack.DefinePlugin(definePluginGlobals),

    new MiniCssExtractPlugin({
      filename: useDevServer ? `[name].css` : `[name].[contenthash].css`,
    }),
    new HtmlWebpackPlugin({
      // Create HTML file that includes references to bundled CSS and JS.
      favicon,
      template: 'src/app/index.ejs',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: !!production,
        useShortDoctype: !!production,
        removeEmptyAttributes: !!production,
        removeStyleLinkTypeAttributes: !!production,
        keepClosingSlash: !!production,
        minifyJS: !!production,
        minifyCSS: !!production,
        minifyURLs: !!production,
      },
      inject: true,
    }),
  ];

  const extractTextOptionsNonGlobal = [
    !extractCSS
      ? {
          loader: 'style-loader',
          options: {
            esModule: true,
            modules: {
              namedExport: true,
            },
          },
        }
      : {
          loader: MiniCssExtractPlugin.loader,
          options: {
            esModule: true,
            modules: {
              namedExport: true,
            },
          },
        },
    {
      loader: 'css-loader',
      options: {
        esModule: true,
        modules: {
          namedExport: true,
          localIdentName: '[name]__[local]___[hash:base64:5]',
        },
        sourceMap: false,
        importLoaders: 1,
      },
    },
    {
      loader: 'postcss-loader',
      options: {
        options: {
          plugins: (loader) => [autoprefixer()],
          sourceMap: false,
        },
      },
    },
    {
      loader: 'resolve-url-loader',
      options: {
        sourceMap: false,
      },
    },
    {
      loader: 'sass-loader',
      options: {
        sourceMap: true,
      },
    },
  ];

  // yaya it's dirty but it's also DRY. DRY and dirty suckas.
  const extractTextOptionsGlobal = _.cloneDeep(extractTextOptionsNonGlobal);
  const extractTextOptionsCss = _.cloneDeep(extractTextOptionsNonGlobal);
  extractTextOptionsCss[1] = extractTextOptionsGlobal[1] = {
    loader: 'css-loader',
    options: {
      modules: false,
      sourceMap: true,
      importLoaders: 1,
    },
  };
  extractTextOptionsCss.splice(extractTextOptionsCss.indexOf('sass-loader'), 1);

  const module = {
    rules: [
      {
        test: /\.ejs$/,
        use: {
          loader: 'ejs-compiled-loader',
          options: {
            htmlmin: true,
            htmlminOptions: {
              removeComments: true,
            },
          },
        },
      },
      // // commented out because it takes FOREVER in admin for some reason and we dont use source maps anyway
      // // maybe someday we will want them and debug the slowness
      ...(useSourceMaps
        ? [
            {
              test: /\.js$/,
              enforce: 'pre',
              use: ['source-map-loader'],
              exclude: [/.*escape-stack.*/g],
            },
          ]
        : []),
      {
        test: /\.(eot|woff2?|ttf|otf|svg)(\?v=\d+.\d+.\d+)?$/,
        type: 'asset',
        generator: {
          filename: 'assets/fonts/[path][name][ext]',
        },
      },
      {
        test: /\.(jpe?g|png|gif|pdf|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]',
        },
      },
      {
        test: (absPath) => /\.scss$/.test(absPath) && !globalSassRegex.test(absPath),
        use: extractTextOptionsNonGlobal,
      },
      {
        test: globalSassRegex,
        use: extractTextOptionsGlobal,
      },
      {
        test: /\.css$/,
        use: extractTextOptionsCss,
      },
    ],
  };

  const mode = production ? 'production' : 'development';
  // webpack config object
  const config = {
    mode,
    optimization: {
      runtimeChunk: true,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          defaultVendors: {
            name: 'vendor',
            // we don't have to test for @creditiq/ here because it resolves to a relative path and doesn't match anyway thanks to workspaces
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
      // comment below to test prod build with dev server with FULL minimization
      minimizer: testProductionBuildWithDevServer
        ? [
            new TerserPlugin({
              parallel: true,
              terserOptions: {
                // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
                mangle: false,
              },
            }),
          ]
        : undefined,
    },

    resolve: {
      fallback: {
        util: require.resolve('util/'),
      },
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@src': path.resolve(absoluteProjectRootPath + '/dist'),
        '@cmpts': path.resolve(absoluteProjectRootPath + '/dist/components'),
      },
      symlinks: true,
    },
    entry,
    target: 'web',
    output,
    plugins,
    module,
    devtool: useSourceMaps //
      ? production
        ? 'source-map'
        : 'eval-source-map'
      : false,
    resolveLoader: {
      modules: ['node_modules', 'node_modules/@creditiq/rig-rig/node_modules'],
    },
    performance: {
      hints: false,
    },
    devServer: useDevServer
      ? {
          historyApiFallback: true,
          hot: true,
          overlay: true,
          port: devPort,
          allowedHosts: ['.creditiq.com'],
        }
      : undefined,
  };
  // return smp.wrap(config);
  return config;
}

module.exports = ({ production }) => createWebpackConfig({ production, absoluteProjectRootPath: path.resolve(__dirname), devPort: 8004 });
