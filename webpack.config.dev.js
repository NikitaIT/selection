module.exports = {
    mode: 'development',
    entry: './src/selection.ts',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ]
    },

    output: {
        path: `${__dirname}/dist`,
        publicPath: 'dist/',
        filename: 'selection.min.js',
        library: 'Selection',
        libraryExport: 'default',
        libraryTarget: 'umd'
    },

    devServer: {
        // host: '0.0.0.0',
        port: 3003
    }
};
