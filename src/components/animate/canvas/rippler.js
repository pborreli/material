angular.module('material.animations')
    /**
     * Port of the Polymer Paper-Ripple code
     *
     * @group Paper Elements
     * @element paper-ripple
     * @homepage github.io
     */
      .service('canvasRenderer', function() {

           var pow = Math.pow;
           var now = Date.now;
           var Rippler = RipplerClazz();

           if (window.performance && performance.now) {
             now = performance.now.bind(performance);
           }

           angular.mixin = function (dst) {
             angular.forEach(arguments, function(obj) {
               if (obj !== dst) {
                 angular.forEach(obj, function(value, key) {
                   // Only mixin if destination value is undefined
                   if ( angular.isUndefined(dst[key]) )
                   {
                    dst[key] = value;
                   }
                 });
               }
             });
             return dst;
           };



    return {

             /**
              * API to render ripple animations
              */
             ripple : function( canvas, options)
             {
               var animator = new Rippler( canvas,  options );

               // Simple API to start and finish ripples based on mouse/touch events
               return {
                 onMouseDown : angular.bind(animator, animator.onMouseDown),
                 onMouseUp : angular.bind(animator, animator.onMouseUp)
               };
             }

           };

          // **********************************************************
          // Rippler Class
          // **********************************************************

          function RipplerClazz() {

            /**
             *  Rippler creates a `paper-ripple` which is a visual effect that other quantum paper elements can
             *  use to simulate a rippling effect emanating from the point of contact.  The
             *  effect can be visualized as a concentric circle with motion.
             */
            function Rippler( canvas, options ) {


              var defaults = {
                /**
                 * The initial opacity set on the wave.
                 *
                 * @attribute initialOpacity
                 * @type number
                 * @default 0.25
                 */
                initialOpacity : 0.25,

                /**
                 * How fast (opacity per second) the wave fades out.
                 *
                 * @attribute opacityDecayVelocity
                 * @type number
                 * @default 0.8
                 */
                opacityDecayVelocity : 0.8,

                /**
                 *
                 */
                backgroundFill : true,

                /**
                 *
                 */
                pixelDensity : 1
              };



              this.canvas = canvas;
              this.waves  = [];

              return angular.extend(this, angular.mixin(options, defaults));
            };

            /**
             *
             */
            Rippler.prototype.onMouseDown = function ( startAt ) {

              var canvas = this.setupCanvas( this.canvas );
              var wave = createWave(this.canvas);

              var width = canvas.width / this.pixelDensity; // Retina canvas
              var height = canvas.height / this.pixelDensity;

              // Auto center ripple if startAt is not defined...
              startAt = startAt || { x : Math.round(width/2), y:Math.round(height/2) };

              wave.isMouseDown = true;
              wave.tDown = 0.0;
              wave.tUp = 0.0;
              wave.mouseUpStart = 0.0;
              wave.mouseDownStart = now();
              wave.startPosition = startAt;
              wave.containerSize = Math.max(width, height);
              wave.maxRadius = distanceFromPointToFurthestCorner(wave.startPosition, {w: width, h: height});

              if (this.canvas.classList.contains("recenteringTouch")) {
                  wave.endPosition = {x: width / 2,  y: height / 2};
                  wave.slideDistance = dist(wave.startPosition, wave.endPosition);
              }

              this.waves.push(wave);

              this.cancelled = false;

              requestAnimationFrame(this._loop);
            };

            /**
             *
             */
            Rippler.prototype.onMouseUp = function () {
              for (var i = 0; i < this.waves.length; i++) {
                // Declare the next wave that has mouse down to be mouse'ed up.
                var wave = this.waves[i];
                if (wave.isMouseDown) {
                  wave.isMouseDown = false
                  wave.mouseUpStart = now();
                  wave.mouseDownStart = 0;
                  wave.tUp = 0.0;
                  break;
                }
              }
              this._loop && requestAnimationFrame(this._loop);
            };

            /**
             *
             */
            Rippler.prototype.cancel = function () {
              this.cancelled = true;
              return this;
            };

            /**
             *
             */
            Rippler.prototype.animate = function (ctx) {
              // Clear the canvas
              ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

              var deleteTheseWaves = [];
              // The oldest wave's touch down duration
              var longestTouchDownDuration = 0;
              var longestTouchUpDuration = 0;
              // Save the last known wave color
              var lastWaveColor = null;
              // wave animation values
              var anim = {
                initialOpacity: this.initialOpacity,
                opacityDecayVelocity: this.opacityDecayVelocity,
                height: ctx.canvas.height,
                width: ctx.canvas.width
              }

              for (var i = 0; i < this.waves.length; i++) {
                var wave = this.waves[i];

                if (wave.mouseDownStart > 0) {
                  wave.tDown = now() - wave.mouseDownStart;
                }
                if (wave.mouseUpStart > 0) {
                  wave.tUp = now() - wave.mouseUpStart;
                }

                // Determine how long the touch has been up or down.
                var tUp = wave.tUp;
                var tDown = wave.tDown;
                longestTouchDownDuration = Math.max(longestTouchDownDuration, tDown);
                longestTouchUpDuration = Math.max(longestTouchUpDuration, tUp);

                // Obtain the instantenous size and alpha of the ripple.
                var radius = waveRadiusFn(tDown, tUp, anim);
                var waveAlpha =  waveOpacityFn(tDown, tUp, anim);
                var waveColor = cssColorWithAlpha(wave.waveColor, waveAlpha);
                lastWaveColor = wave.waveColor;

                // Position of the ripple.
                var x = wave.startPosition.x;
                var y = wave.startPosition.y;

                // Ripple gravitational pull to the center of the canvas.
                if (wave.endPosition) {

                  var translateFraction = waveGravityToCenterPercentageFn(tDown, tUp, wave.maxRadius);

                  // This translates from the origin to the center of the view  based on the max dimension of
                  var translateFraction = Math.min(1, radius / wave.containerSize * 2 / Math.sqrt(2) );

                  x += translateFraction * (wave.endPosition.x - wave.startPosition.x);
                  y += translateFraction * (wave.endPosition.y - wave.startPosition.y);
                }

                // If we do a background fill fade too, work out the correct color.
                var bgFillColor = null;
                if (this.backgroundFill) {
                  var bgFillAlpha = waveOuterOpacityFn(tDown, tUp, anim);
                  bgFillColor = cssColorWithAlpha(wave.waveColor, bgFillAlpha);
                }

                // Draw the ripple.
                drawRipple(ctx, x, y, radius, waveColor, bgFillColor);

                // Determine whether there is any more rendering to be done.
                var maximumWave = waveAtMaximum(wave, radius, anim);
                var waveDissipated = waveDidFinish(wave, radius, anim);
                var shouldKeepWave = !waveDissipated || maximumWave;
                var shouldRenderWaveAgain = !waveDissipated && !maximumWave;

                if (!shouldKeepWave || this.cancelled) {
                  deleteTheseWaves.push(wave);
                }
              }

              if (shouldRenderWaveAgain) {
                requestAnimationFrame(this._loop);
              }

              for (var i = 0; i < deleteTheseWaves.length; ++i) {
                var wave = deleteTheseWaves[i];
                removeWaveFromScope(this, wave);
              }

              if (!this.waves.length) {
                // If there is nothing to draw, clear any drawn waves now because
                // we're not going to get another requestAnimationFrame any more.
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                this._loop = null;
              }

              return this;
            };


            Rippler.prototype.adjustBounds = function( canvas )
            {
              // Default to parent container to define bounds
              var self = this,
                src = canvas.parentNode.getBoundingClientRect(),  // read-only
                bounds = { width : src.width, height: src.height };

              angular.forEach("width height".split(" "), function( style ) {
                var value = (self[style] != "auto") ? self[style] : undefined;

                // Allow CSS to explicitly define bounds (instead of parent container
                if ( angular.isDefined(value ) ) {
                  bounds[style] = sanitizePosition( value );
                  canvas.setAttribute(style, bounds[style] * self.pixelDensity + "px");
                }

              });

              // NOTE: Modified from polymer implementation
              canvas.setAttribute('width', bounds.width * this.pixelDensity + "px");
              canvas.setAttribute('height', bounds.height * this.pixelDensity + "px");


                function sanitizePosition( style )
                {
                  var val = style.replace('px','');
                  return val;
                }

              return canvas;
            }


            /**
             * Resize the canvas to fill the parent's dimensions...
             */
            Rippler.prototype.setupCanvas = function ( canvas ) {

              var ctx = this.adjustBounds(canvas).getContext('2d');
              ctx.scale(this.pixelDensity, this.pixelDensity);
              
              if (!this._loop) {
                this._loop = this.animate.bind(this, ctx);
              }
              return canvas;
            };


            return Rippler;

          };




          // **********************************************************
          // Private Wave Methods
          // **********************************************************



          /**
           *
           */
          function waveRadiusFn(touchDownMs, touchUpMs, anim) {
            // Convert from ms to s.
            var waveMaxRadius = 150;
            var touchDown = touchDownMs / 1000;
            var touchUp = touchUpMs / 1000;
            var totalElapsed = touchDown + touchUp;
            var ww = anim.width, hh = anim.height;
            // use diagonal size of container to avoid floating point math sadness
            var waveRadius = Math.min(Math.sqrt(ww * ww + hh * hh), waveMaxRadius) * 1.1 + 5;
            var duration = 1.1 - .2 * (waveRadius / waveMaxRadius);
            var tt = (totalElapsed / duration);

            var size = waveRadius * (1 - Math.pow(80, -tt));
            return Math.abs(size);
          }

          /**
           *
           */
          function waveOpacityFn(td, tu, anim) {
            // Convert from ms to s.
            var touchDown = td / 1000;
            var touchUp = tu / 1000;
            var totalElapsed = touchDown + touchUp;

            if (tu <= 0) {  // before touch up
              return anim.initialOpacity;
            }
            return Math.max(0, anim.initialOpacity - touchUp * anim.opacityDecayVelocity);
          }

          /**
           *
           */
          function waveOuterOpacityFn(td, tu, anim) {
            // Convert from ms to s.
            var touchDown = td / 1000;
            var touchUp = tu / 1000;

            // Linear increase in background opacity, capped at the opacity
            // of the wavefront (waveOpacity).
            var outerOpacity = touchDown * 0.3;
            var waveOpacity = waveOpacityFn(td, tu, anim);
            return Math.max(0, Math.min(outerOpacity, waveOpacity));
          }

          /**
           *
           */
          function waveGravityToCenterPercentageFn(td, tu, r) {
            // Convert from ms to s.
            var touchDown = td / 1000;
            var touchUp = tu / 1000;
            var totalElapsed = touchDown + touchUp;

            return Math.min(1.0, touchUp * 6);
          }

          /**
           * Determines whether the wave should be completely removed.
           */
          function waveDidFinish(wave, radius, anim) {
            var waveMaxRadius = 150;
            var waveOpacity = waveOpacityFn(wave.tDown, wave.tUp, anim);
            // If the wave opacity is 0 and the radius exceeds the bounds
            // of the element, then this is finished.
            if (waveOpacity < 0.01 && radius >= Math.min(wave.maxRadius, waveMaxRadius)) {
              return true;
            }
            return false;
          };

          /**
           *
           */
          function waveAtMaximum(wave, radius, anim) {
            var waveMaxRadius = 150;
            var waveOpacity = waveOpacityFn(wave.tDown, wave.tUp, anim);
            if (waveOpacity >= anim.initialOpacity && radius >= Math.min(wave.maxRadius, waveMaxRadius)) {
              return true;
            }
            return false;
          }

          /**
           *
           */
          function createWave(elem) {
            var elementStyle = window.getComputedStyle(elem);

            var wave = {
              waveColor: elementStyle.color,
              maxRadius: 0,
              isMouseDown: false,
              mouseDownStart: 0.0,
              mouseUpStart: 0.0,
              tDown: 0,
              tUp: 0
            };
            return wave;
          }

          /**
           *
           */
          function removeWaveFromScope(scope, wave) {
            if (scope.waves) {
              var pos = scope.waves.indexOf(wave);
              scope.waves.splice(pos, 1);
            }
          };

          /**
           *
           */
          function drawRipple(ctx, x, y, radius, innerColor, outerColor) {
            if (outerColor) {
              ctx.fillStyle = outerColor || 'rgba(252, 252, 158, 1.0)';
              ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height);
            }
            ctx.beginPath();

            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = innerColor || 'rgba(252, 252, 158, 1.0)';
            ctx.fill();

            //ctx.closePath();
          }


          /**
           *
           */
          function cssColorWithAlpha(cssColor, alpha) {
            var parts = cssColor ? cssColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/) : null;
            if (typeof alpha == 'undefined') {
              alpha = 1;
            }
            if (!parts) {
              return 'rgba(255, 255, 255, ' + alpha + ')';
            }
            return 'rgba(' + parts[1] + ', ' + parts[2] + ', ' + parts[3] + ', ' + alpha + ')';
          }

          /**
           *
           */
          function dist(p1, p2) {
            return Math.sqrt(pow(p1.x - p2.x, 2) + pow(p1.y - p2.y, 2));
          }

          /**
           *
           */
          function distanceFromPointToFurthestCorner(point, size) {
            var tl_d = dist(point, {x: 0, y: 0});
            var tr_d = dist(point, {x: size.w, y: 0});
            var bl_d = dist(point, {x: 0, y: size.h});
            var br_d = dist(point, {x: size.w, y: size.h});
            return Math.max(tl_d, tr_d, bl_d, br_d);
          }

        });





