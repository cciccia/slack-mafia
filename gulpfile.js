'use strict';

const gulp = require('gulp');
const rimraf = require('gulp-rimraf');
const tslint = require('gulp-tslint');
const mocha = require('gulp-mocha');
const shell = require('gulp-shell');

const outDir = __dirname + '/build';

/**
 * Remove build directory.
 */
gulp.task('clean', function () {
  return gulp.src(outDir, { read: false })
    .pipe(rimraf());
});

/**
 * Lint all custom TypeScript files.
 */
gulp.task('tslint', ['clean'], () => {
  return gulp.src('src/**/*.ts')
    .pipe(tslint( { 
      formatter: 'prose'
    }))
    .pipe(tslint.report());
});

/**
 * Compile TypeScript.
 */

function compileTS(args, cb) {
  return exec(tscCmd + args, (err, stdout, stderr) => {
    console.log(stdout);

    if (stderr) {
      console.log(stderr);
    }
    cb(err);
  });
}

gulp.task('config', ['clean'], function() {
    return gulp.src(['src/**/*.json', 'src/**/*.js']).pipe(gulp.dest('build/src'));
});

gulp.task('compile', ['clean'], shell.task([
  'npm run tsc',
]))

/**
 * Build the project.
 */
gulp.task('build', ['tslint', 'config', 'compile'], () => {
  console.log('Building the project ...');
});

/**
 * Run tests.
 */
gulp.task('test', ['build'], (cb) => {
  gulp.src(['build/test/**/*.js'])
    .pipe(mocha())
    .once('error', (error) => {
      console.log(error);
      process.exit(1);
    })
    .once('end', () => {
      process.exit();
    });
});

gulp.task('default', ['build']);