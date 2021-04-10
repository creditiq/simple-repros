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
function createWebpackConfig({
  production,
  absoluteProjectRootPath,
  favicon,
  getApiStageVariables = () => ({}),
  globalScssPaths = [],
  extractCSS = production,
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
  const testProductionBuildWithDevServer = !!stageSettingsEnv.CIQ_TEST_PROD_BUILD || true;
  production = production || testProductionBuildWithDevServer;
  const useDevServer = !production || testProductionBuildWithDevServer;

  const globalSassRegex = new RegExp(`(${globalScssPaths.join('|')})\\.scss$`);
  const useSourceMaps = false; // could make this !production if we want it in dev
  const entry = './dist/app/index';

  const output = useDevServer
    ? {
        path: path.resolve(absoluteProjectRootPath + `/dist`),
        publicPath: '/',
        filename: 'bundle.js',
      }
    : {
        path: path.resolve(absoluteProjectRootPath + `/dist/main`),
        publicPath: '/',
        filename: '[name].[chunkhash].js',
        sourceMapFilename: '[file].map',
      };

  const definePluginGlobals = {
    __DEV__: !production,
    // auto stringify all strings, if for some horrible reason we wanted to insert a genuine code token we can override... but let's not do that
    ..._.mapValues(getApiStageVariables(production, { apiStage, localBackend, localSocket, localCheckout }), (v) =>
      _.isString(v) ? JSON.stringify(v) : v
    ),
  };

  const plugins = [
    // !production && new BundleAnalyzerPlugin() || (() => {}),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    // new DuplicatePackageCheckerPlugin(),

    new webpack.DefinePlugin(definePluginGlobals),

    new MiniCssExtractPlugin({
      filename: `[name].[contenthash].css`,
    }),
    new HtmlWebpackPlugin({
      // Create HTML file that includes references to bundled CSS and JS.
      favicon,
      template: '!!ejs-compiled-loader!src/app/index.ejs',
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
    !extractCSS ? 'style-loader' : MiniCssExtractPlugin.loader,
    {
      loader: 'css-loader',
      options: {
        modules: true,
        sourceMap: false,
        importLoaders: 1,
        localIdentName: '[name]__[local]___[hash:base64:5]',
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
      localIdentName: '[name]__[local]___[hash:base64:5]',
    },
  };
  extractTextOptionsCss.splice(extractTextOptionsCss.indexOf('sass-loader'), 1);

  const module = {
    rules: [
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
      // {
      //   test: /\.tsx?$/,
      //   use: [
      //     {
      //       loader: 'ts-loader',
      //       options: {
      //         compilerOptions: {
      //           outDir: './',
      //         },
      //       },
      //     },
      //   ],
      // },
      ...[
        { extension: 'eot' },
        { extension: 'woff(2)?', mimetype: 'application/font-woff' },
        { extension: 'ttf', mimetype: 'application/octet-stream' },
        { extension: 'otf', mimetype: 'font/otf' },
        { extension: 'svg', mimetype: 'image/svg+xml' },
      ].map(({ extension, ...options }) => ({
        test: new RegExp(`.${extension}(\\?v=\\d+.\\d+.\\d+)?$`),
        use: [
          {
            loader: 'url-loader',
            options: {
              fallback: require.resolve('file-loader'),
              limit: 10000,
              name: 'assets/fonts/[folder]/[name].[ext]',
              ...options,
            },
          },
        ],
      })),
      {
        test: /\.(jpe?g|png|gif|pdf|ico)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'assets/images/[name].[ext]',
            },
          },
        ],
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

  // webpack config object
  const config = {
    mode: production ? 'production' : 'development',
    optimization: {
      usedExports: true,
      sideEffects: true, // this currently breaks i believe due to some circular dep thing
      concatenateModules: !!production,
      minimize: !!production,
      // uncomment below to see symbols when in dev test mode
      minimizer: [
        new TerserPlugin({
          parallel: true,
          sourceMap: true, // Must be set to true if using source-maps in production
          terserOptions: {
            // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
            mangle: false,
          },
        }),
      ],
      splitChunks: {
        cacheGroups: {
          styles: {
            name: 'styles',
            test: /\.css$/,
            chunks: 'all',
            enforce: true,
          },
        },
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
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
    performance: {
      hints: false,
    },
    devServer: useDevServer
      ? {
          historyApiFallback: false,
          hot: false,
          overlay: false,
          port: devPort,
        }
      : undefined,
  };
  // return smp.wrap(config);
  return config;
}

module.exports = ({ production }) => createWebpackConfig({ production, absoluteProjectRootPath: path.resolve(__dirname), devPort: 8004 });
