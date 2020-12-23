const AWSXRay = require('aws-xray-sdk-core');
const { logger } = require('aws-xray-sdk-core/lib/middleware/sampling/service_connector');

const mwUtils = AWSXRay.middleware;

/**
 * Express middleware module.
 *
 * Exposes Express middleware functions to enable automated data capturing on a web service. To enable on a Node.js/Express application,
 * use 'app.use(AWSXRayExpress.openSegment())' before defining your routes.  After your routes, before any extra error
 * handling middleware, use 'app.use(AWSXRayExpress.closeSegment())'.
 * Use AWSXRay.getSegment() to access the current sub/segment.
 * Otherwise, for manual mode, this appends the Segment object to the request object as req.segment.
 * @module express_mw
 */
var expressMW = {

  /**
   * Use 'app.use(AWSXRayExpress.openSegment('defaultName'))' before defining your routes.
   * Use AWSXRay.getSegment() to access the current sub/segment.
   * Otherwise, for manual mode, this appends the Segment object to the request object as req.segment.
   * @param {string} defaultName - The default name for the segment.
   * @alias module:express_mw.openSegment
   * @returns {function}
   */
  openSegment: function openSegment(defaultName) {
    if (!defaultName || typeof defaultName !== 'string')
      throw new Error('Default segment name was not supplied.  Please provide a string.');

    mwUtils.setDefaultName(defaultName);

    return function (req, res, next) {
      var segment = mwUtils.traceRequestResponseCycle(req, res);

      if (AWSXRay.isAutomaticMode()) {
        var ns = AWSXRay.getNamespace();
        ns.bindEmitter(req);
        ns.bindEmitter(res);

        ns.run(function () {
          AWSXRay.setSegment(segment);

          if (next) { next(); }
        });
      } else {
        req.segment = segment;
        if (next) { next(); }
      }
    };
  },

  /**
   * After your routes, before any extra error handling middleware, use 'app.use(AWSXRayExpress.closeSegment())'.
   * This is error-handling middleware, so it is called only when there is a server-side fault.
   * @alias module:express_mw.closeSegment
   * @returns {function}
   */
  closeSegment: function closeSegment() {
    return function close(err, req, res, next) {
      var segment = AWSXRay.resolveSegment(req.segment);

      if (segment && err) {
        segment.addError(err);
        logger.getLogger().debug('Added Express server fault to segment');
      }

      if (next)
        next(err);
    };
  }
};

module.exports = expressMW;
