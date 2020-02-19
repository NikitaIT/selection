const TerserPlugin = require('terser-webpack-plugin');
const {version} = require('./package');
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: './src/selection.ts',

    output: {
        path: `${__dirname}/dist`,
        publicPath: 'dist/',
        filename: 'selection.min.js',
        library: 'Selection',
        libraryExport: 'default',
        libraryTarget: 'umd'
    },

    module: {
        rules: [
		        {
			          test: /\.ts?$/,
                use: [
                    {
                        loader: 'babel-loader'
                    },
                    {
                        loader: 'ts-loader'
                    },
                ],
			          exclude: /node_modules/
		        },
            {
                test: /\.js$/,
                loader: [
                    'babel-loader',
                    'eslint-loader'
                ]
            }
        ]
    },
		resolve: {
			extensions: [ '.ts', '.js' ]
		},

    plugins: [
        new webpack.SourceMapDevToolPlugin({
            filename: 'selection.min.js.map'
        }),

        new webpack.BannerPlugin({
            banner: `Selectionjs ${version} MIT | https://github.com/Simonwep/selection`
        })
    ],

    optimization: {
        minimizer: [
            new TerserPlugin({
                extractComments: false,
                sourceMap: true,
                terserOptions: {
                    mangle: {
                        properties: {
                            regex: /^_/
                        }
                    }
                }
            })
        ]
    }
};
