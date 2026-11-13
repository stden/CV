const gulp = require('gulp');
const { default: prefixer } = require('gulp-autoprefixer');
const sass = require('gulp-sass')(require('sass'));
const uglify = require('gulp-uglify');
const cssmin = require('gulp-clean-css');
const notify = require('gulp-notify');
const gulpif = require('gulp-if');

const buildRoot = process.env.CV_BUILD_DIR || 'assets';
const isCI = Boolean(process.env.CI) || process.argv.includes('--type=ci');
const buildPaths = {
    js: `${buildRoot}/js/`,
    css: `${buildRoot}/css/`
};

function buildJavaScript() {
    return gulp.src('src/js/main.js')
        .pipe(uglify())
        .pipe(gulp.dest(buildPaths.js))
        .pipe(gulpif(!isCI, notify('JS compiled: <%= file.relative %>!')));
}

function buildStyles() {
    return gulp.src('src/scss/style.scss')
        .pipe(sass())
        .pipe(prefixer())
        .pipe(cssmin())
        .pipe(gulp.dest(buildPaths.css))
        .pipe(gulpif(!isCI, notify('STYLE compiled: <%= file.relative %>!')));
}

function watchFiles() {
    gulp.watch('src/scss/**/*.scss', buildStyles);
    gulp.watch('src/js/**/*.js', buildJavaScript);
}

const build = gulp.parallel(buildJavaScript, buildStyles);
exports['js:build'] = buildJavaScript;
exports['style:build'] = buildStyles;
exports.build = build;
exports.watch = watchFiles;
exports.default = gulp.series(build, watchFiles);
