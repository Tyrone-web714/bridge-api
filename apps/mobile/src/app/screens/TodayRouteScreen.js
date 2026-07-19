  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  function _interopDefault(e) {
    return e && e.__esModule ? e : {
      default: e
    };
  }
  Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function () {
      return TodayRouteScreen;
    }
  });
  var _babelRuntimeHelpersAsyncToGenerator = require("@babel/runtime/helpers/asyncToGenerator");
  var _asyncToGenerator = _interopDefault(_babelRuntimeHelpersAsyncToGenerator);
  var _babelRuntimeHelpersSlicedToArray = require("@babel/runtime/helpers/slicedToArray");
  var _slicedToArray = _interopDefault(_babelRuntimeHelpersSlicedToArray);
  var _react = require("react");
  var _reactNative = require("react-native");
  var _reactNativeSafeAreaContext = require("react-native-safe-area-context");
  var _componentsAccountKnowledgePanel = require("../components/AccountKnowledgePanel");
  var AccountKnowledgePanel = _interopDefault(_componentsAccountKnowledgePanel);
  var _configApi = require("../config/api");
  var _servicesRouteManifestApi = require("../services/routeManifestApi");
  var _servicesRouteManifestOfflineStore = require("../services/routeManifestOfflineStore");
  var _servicesDeliveryDocumentService = require("../services/deliveryDocumentService");
  var _servicesZebraPrinterService = require("../services/zebraPrinterService");
  var _utilsRouteDate = require("../utils/routeDate");
  var _reactJsxRuntime = require("react/jsx-runtime");
  var DRIVER_RECEIPT_WINDOW_MS = 86400000;
  function formatScheduledTime(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    // Imported manifest times are wall-clock schedule values, not UTC instants.
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: _configApi.ROUTE_OPERATING_TIME_ZONE
    });
  }
  function isDriverReceiptWindowOpen(completedAt) {
    if (!completedAt) return true;
    var completedAtMs = new Date(completedAt).getTime();
    return Number.isFinite(completedAtMs) && Date.now() - completedAtMs <= DRIVER_RECEIPT_WINDOW_MS;
  }
  function formatRouteDate(value) {
    if (!value) return 'Today';
    var date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
  function buildStopAddress(stop) {
    var cityLine = [stop.city, stop.stateCode, stop.postalCode].filter(Boolean).join(' ');
    return [stop.destinationAddress, cityLine].filter(Boolean).join(', ');
  }
  function isStopFinished(stop) {
    return ['completed', 'departed', 'skipped', 'undelivered'].includes(String(stop?.status || '').toLowerCase());
  }
  function getNextStop(stops) {
    return stops.find(stop => !isStopFinished(stop)) || null;
  }
  function formatStopWindow(stop) {
    var arrival = formatScheduledTime(stop.plannedArrivalAt);
    var departure = formatScheduledTime(stop.plannedDepartureAt);
    if (arrival === '-' && departure === '-') return 'No planned window';
    if (departure === '-') return arrival;
    return `${arrival} - ${departure}`;
  }
  function normalizeStopStatus(status) {
    var normalized = String(status || 'pending').trim().toLowerCase();
    return normalized === 'service_started' ? 'servicing' : normalized;
  }
  function getStopStatusLabel(status) {
    switch (normalizeStopStatus(status)) {
      case 'en_route':
        return 'En route';
      case 'arrived':
        return 'Arrived';
      case 'servicing':
        return 'Servicing';
      case 'completed':
        return 'Completed';
      case 'departed':
        return 'Departed';
      case 'skipped':
        return 'Skipped';
      case 'undelivered':
        return 'No delivery';
      default:
        return 'Pending';
    }
  }
  function getNonDeliveryReasonLabel(reason) {
    switch (String(reason || '').trim().toLowerCase()) {
      case 'customer_refused':
        return 'Customer refused';
      case 'missed_time_window':
        return 'Driver missed time window';
      case 'business_closed':
        return 'Business closed';
      case 'no_payment':
        return 'Customer did not have payment';
      default:
        return '';
    }
  }
  function getLifecycleActionLabel(status) {
    switch (normalizeStopStatus(status)) {
      case 'en_route':
        return 'Arrived';
      case 'arrived':
        return 'Begin Service';
      case 'servicing':
        return 'Open Delivery';
      case 'completed':
      case 'departed':
      case 'skipped':
      case 'undelivered':
        return 'Done';
      default:
        return 'Start Stop';
    }
  }
  function getLifecycleNextStatus(status) {
    switch (normalizeStopStatus(status)) {
      case 'en_route':
        return 'arrived';
      case 'arrived':
        return 'servicing';
      case 'servicing':
        return 'completed';
      default:
        return 'en_route';
    }
  }
  function TodayRouteScreen(_ref) {
    var navigation = _ref.navigation,
      route = _ref.route;
    var confirmedDriverId = route?.params?.driverId || _configApi.DRIVER_ID;
    var confirmedDriverName = route?.params?.driverName || _configApi.DRIVER_NAME || confirmedDriverId;
    var confirmedRouteDate = route?.params?.routeDate || (0, _utilsRouteDate.getLocalRouteDate)();
    var _useState = (0, _react.useState)(null),
      _useState2 = (0, _slicedToArray.default)(_useState, 2),
      routeManifest = _useState2[0],
      setRouteManifest = _useState2[1];
    var _useState3 = (0, _react.useState)(true),
      _useState4 = (0, _slicedToArray.default)(_useState3, 2),
      isLoading = _useState4[0],
      setIsLoading = _useState4[1];
    var _useState5 = (0, _react.useState)(false),
      _useState6 = (0, _slicedToArray.default)(_useState5, 2),
      isRefreshing = _useState6[0],
      setIsRefreshing = _useState6[1];
    var _useState7 = (0, _react.useState)(''),
      _useState8 = (0, _slicedToArray.default)(_useState7, 2),
      error = _useState8[0],
      setError = _useState8[1];
    var _useState9 = (0, _react.useState)(null),
      _useState0 = (0, _slicedToArray.default)(_useState9, 2),
      updatingStopId = _useState0[0],
      setUpdatingStopId = _useState0[1];
    var _useState1 = (0, _react.useState)(''),
      _useState10 = (0, _slicedToArray.default)(_useState1, 2),
      copilotQuestion = _useState10[0],
      setCopilotQuestion = _useState10[1];
    var _useState11 = (0, _react.useState)(null),
      _useState12 = (0, _slicedToArray.default)(_useState11, 2),
      copilotAnswer = _useState12[0],
      setCopilotAnswer = _useState12[1];
    var _useState13 = (0, _react.useState)(''),
      _useState14 = (0, _slicedToArray.default)(_useState13, 2),
      copilotError = _useState14[0],
      setCopilotError = _useState14[1];
    var _useState15 = (0, _react.useState)(false),
      _useState16 = (0, _slicedToArray.default)(_useState15, 2),
      isCopilotLoading = _useState16[0],
      setIsCopilotLoading = _useState16[1];
    var _useState17 = (0, _react.useState)(0),
      _useState18 = (0, _slicedToArray.default)(_useState17, 2),
      pendingSyncCount = _useState18[0],
      setPendingSyncCount = _useState18[1];
    var _useState19 = (0, _react.useState)(false),
      _useState20 = (0, _slicedToArray.default)(_useState19, 2),
      isPrintingCloseout = _useState20[0],
      setIsPrintingCloseout = _useState20[1];
    var stops = Array.isArray(routeManifest?.stops) ? routeManifest.stops : [];
    var nextStop = (0, _react.useMemo)(() => getNextStop(stops), [stops]);
    var completedStops = stops.filter(isStopFinished).length;
    var loadAssignedRoute = /*#__PURE__*/function () {
      var _ref2 = (0, _asyncToGenerator.default)(function* () {
        var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref3$quiet = _ref3.quiet,
          quiet = _ref3$quiet === undefined ? false : _ref3$quiet;
        if (quiet) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError('');
        try {
          if (quiet) {
            yield (0, _servicesRouteManifestApi.flushPendingStopStatusUpdates)();
          } else {
            (0, _servicesRouteManifestApi.flushPendingStopStatusUpdates)().catch(() => {});
          }
          var assignedRoute = yield (0, _servicesRouteManifestApi.fetchAssignedDriverRouteFromDates)({
            routeDates: (0, _utilsRouteDate.getAssignedRouteLookupDates)(confirmedRouteDate),
            driverId: confirmedDriverId,
            driverName: confirmedDriverName
          });
          setRouteManifest(assignedRoute);
          setPendingSyncCount(yield (0, _servicesRouteManifestOfflineStore.getPendingStopOperationCount)({
            driverId: confirmedDriverId
          }));
        } catch (loadError) {
          setError(loadError.message || 'Unable to load assigned route.');
          setRouteManifest(null);
          setPendingSyncCount(yield (0, _servicesRouteManifestOfflineStore.getPendingStopOperationCount)({
            driverId: confirmedDriverId
          }));
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
      return function loadAssignedRoute() {
        return _ref2.apply(this, arguments);
      };
    }();
    (0, _react.useEffect)(() => {
      loadAssignedRoute();
    }, [confirmedDriverId, confirmedDriverName, confirmedRouteDate]);
    var updateStopStatus = /*#__PURE__*/function () {
      var _ref4 = (0, _asyncToGenerator.default)(function* (stop, status) {
        var extraPayload = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        if (!stop?.id) return null;
        setUpdatingStopId(stop.id);
        try {
          var result = yield (0, _servicesRouteManifestApi.updateAssignedRouteStopStatus)(stop.id, {
            status,
            routeDate: routeManifest?.routeDate,
            ...extraPayload
          }, {
            driverId: confirmedDriverId,
            driverName: confirmedDriverName
          });
          if (result?.route) {
            setRouteManifest(result.route);
          } else {
            yield loadAssignedRoute({
              quiet: true
            });
          }
          setPendingSyncCount(yield (0, _servicesRouteManifestOfflineStore.getPendingStopOperationCount)({
            driverId: confirmedDriverId
          }));
          return result || null;
        } catch (statusError) {
          _reactNative.Alert.alert('Stop update could not be saved', statusError.message || 'The phone could not save this stop update.');
          return null;
        } finally {
          setUpdatingStopId(null);
        }
      });
      return function updateStopStatus(_x, _x2) {
        return _ref4.apply(this, arguments);
      };
    }();
    var openStopNavigation = /*#__PURE__*/function () {
      var _ref5 = (0, _asyncToGenerator.default)(function* (stop) {
        var mode = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'start';
        if (!stop) return;
        if (mode === 'start') {
          yield updateStopStatus(stop, 'en_route');
        }
        var destinationAddress = buildStopAddress(stop);
        navigation.navigate('Map', {
          mode,
          destinationAddress,
          destinationPlaceId: null,
          routeStopId: stop.id,
          routeManifestDate: routeManifest?.routeDate,
          destinationDetails: {
            name: stop.accountName || stop.destinationAddress,
            formattedAddress: destinationAddress,
            secondaryText: destinationAddress,
            routeManifestId: routeManifest?.id,
            routeNumber: routeManifest?.routeNumber,
            routeStopId: stop.id,
            routeDate: routeManifest?.routeDate,
            accountNumber: stop.accountNumber,
            accountName: stop.accountName,
            routeManifestDriverId: confirmedDriverId,
            routeManifestDriverName: confirmedDriverName
          },
          routeManifestDriverId: confirmedDriverId,
          routeManifestDriverName: confirmedDriverName
        });
      });
      return function openStopNavigation(_x3) {
        return _ref5.apply(this, arguments);
      };
    }();
    var openStopDeliveryNotes = stop => {
      var destinationAddress = buildStopAddress(stop);
      navigation.navigate('DeliveryNotes', {
        destinationAddress,
        destinationPlaceId: null,
        accountNumber: stop.accountNumber,
        driverId: confirmedDriverId,
        driverName: confirmedDriverName,
        destinationDetails: {
          name: stop.accountName || stop.destinationAddress,
          formattedAddress: destinationAddress,
          accountNumber: stop.accountNumber,
          accountName: stop.accountName,
          routeStopId: stop.id,
          routeDate: routeManifest?.routeDate,
          routeManifestDriverId: confirmedDriverId,
          routeManifestDriverName: confirmedDriverName
        }
      });
    };
    var moveStopToNextLifecycleState = /*#__PURE__*/function () {
      var _ref6 = (0, _asyncToGenerator.default)(function* (stop) {
        var nextStatus = getLifecycleNextStatus(stop?.status);
        if (nextStatus === 'en_route') {
          openStopNavigation(stop, 'start');
          return;
        }
        if (normalizeStopStatus(stop?.status) === 'servicing') {
          navigation.navigate('DeliverySettlement', {
            stopId: stop.id,
            routeDate: routeManifest?.routeDate,
            driverId: confirmedDriverId,
            driverName: confirmedDriverName
          });
          return;
        }
        var result = yield updateStopStatus(stop, nextStatus);
      });
      return function moveStopToNextLifecycleState(_x4) {
        return _ref6.apply(this, arguments);
      };
    }();
    var markStopUndelivered = /*#__PURE__*/function () {
      var _ref7 = (0, _asyncToGenerator.default)(function* (stop, nonDeliveryReason) {
        navigation.navigate('DeliverySettlement', {
          stopId: stop.id,
          routeDate: routeManifest?.routeDate,
          driverId: confirmedDriverId,
          driverName: confirmedDriverName,
          nonDeliveryReason
        });
      });
      return function markStopUndelivered(_x5, _x6) {
        return _ref7.apply(this, arguments);
      };
    }();
    var promptNoDeliveryReason = stop => {
      if (!stop || updatingStopId === stop.id) return;
      _reactNative.Alert.alert('No delivery reason', 'Select why this account did not receive product.', [{
        text: 'Customer refused',
        onPress: () => markStopUndelivered(stop, 'customer_refused')
      }, {
        text: 'Business closed',
        onPress: () => markStopUndelivered(stop, 'business_closed')
      }, {
        text: 'More reasons',
        onPress: () => _reactNative.Alert.alert('No delivery reason', 'Select why this account did not receive product.', [{
          text: 'Missed time window',
          onPress: () => markStopUndelivered(stop, 'missed_time_window')
        }, {
          text: 'No payment',
          onPress: () => markStopUndelivered(stop, 'no_payment')
        }, {
          text: 'Cancel',
          style: 'cancel'
        }])
      }]);
    };
    var askCopilot = /*#__PURE__*/function () {
      var _ref8 = (0, _asyncToGenerator.default)(function* () {
        var question = copilotQuestion.trim();
        if (!question) {
          _reactNative.Alert.alert('Driver Copilot', 'Type a question before asking the copilot.');
          return;
        }
        setIsCopilotLoading(true);
        setCopilotError('');
        try {
          var data = yield (0, _servicesRouteManifestApi.askDriverCopilot)({
            question,
            routeDate: routeManifest?.routeDate,
            currentStopId: nextStop?.id || null
          }, {
            driverId: confirmedDriverId,
            driverName: confirmedDriverName
          });
          setCopilotAnswer(data?.ai || null);
        } catch (copilotRequestError) {
          setCopilotAnswer(null);
          setCopilotError(copilotRequestError.message || 'Driver copilot unavailable.');
        } finally {
          setIsCopilotLoading(false);
        }
      });
      return function askCopilot() {
        return _ref8.apply(this, arguments);
      };
    }();
    var printRouteCloseout = /*#__PURE__*/function () {
      var _ref9 = (0, _asyncToGenerator.default)(function* () {
        if (!routeManifest?.id) return;
        setIsPrintingCloseout(true);
        try {
          var document = yield (0, _servicesRouteManifestApi.fetchRouteCloseoutDocument)(routeManifest.id, {
            driverId: confirmedDriverId,
            driverName: confirmedDriverName
          });
          var selectedPrinter = yield (0, _servicesZebraPrinterService.readSelectedPrinter)();
          var printer = yield (0, _servicesZebraPrinterService.printZpl)((0, _servicesDeliveryDocumentService.buildZplDocument)(document), selectedPrinter);
          _reactNative.Alert.alert('Print sent', `Route turn-in receipt sent to ${printer.name}.`);
        } catch (printError) {
          _reactNative.Alert.alert('Route receipt unavailable', printError.message || 'The route turn-in receipt could not be printed.');
        } finally {
          setIsPrintingCloseout(false);
        }
      });
      return function printRouteCloseout() {
        return _ref9.apply(this, arguments);
      };
    }();
    var openFinalInventoryCloseout = () => {
      if (!routeManifest?.id) return;
      navigation.navigate('WarehouseInventory', {
        routeNumber: routeManifest.routeNumber,
        routeDate: routeManifest.routeDate,
        initialMode: 'return'
      });
    };
    var renderLifecycleActions = function (stop) {
      var _ref0 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref0$primaryOnly = _ref0.primaryOnly,
        primaryOnly = _ref0$primaryOnly === undefined ? false : _ref0$primaryOnly;
      var normalizedStatus = normalizeStopStatus(stop?.status);
      var isUpdating = updatingStopId === stop?.id;
      var isFinished = isStopFinished(stop);
      var primaryLabel = getLifecycleActionLabel(stop?.status);
      if (isFinished) {
        var isUndelivered = normalizeStopStatus(stop?.status) === 'undelivered';
        return /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
          style: styles.finishedStopActions,
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.View, {
            style: [styles.lifecycleCompletePill, isUndelivered && styles.lifecycleUndeliveredPill],
            children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: [styles.lifecycleCompleteText, isUndelivered && styles.lifecycleUndeliveredText],
              children: isUndelivered ? 'No Delivery' : 'Completed'
            })
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
            onPress: () => navigation.navigate('DeliverySettlement', {
              stopId: stop.id,
              routeDate: routeManifest?.routeDate,
              driverId: confirmedDriverId,
              driverName: confirmedDriverName
            }),
            style: _ref1 => {
              var pressed = _ref1.pressed;
              return [styles.completedDetailsButton, pressed && styles.buttonPressed];
            },
            children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.completedDetailsButtonText,
              children: "Receipt / Details"
            })
          })]
        });
      }
      return /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
        style: primaryOnly ? styles.nextStopActions : styles.stopActions,
        children: [(primaryOnly || normalizedStatus !== 'pending') && /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
          onPress: () => openStopNavigation(stop, primaryOnly ? 'directions' : 'start'),
          disabled: isUpdating,
          style: _ref10 => {
            var pressed = _ref10.pressed;
            return [primaryOnly ? styles.secondaryActionButton : styles.stopActionButton, pressed && styles.buttonPressed];
          },
          children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: primaryOnly ? styles.secondaryActionText : styles.stopActionText,
            children: primaryOnly ? 'Directions' : 'Navigate'
          })
        }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
          onPress: () => moveStopToNextLifecycleState(stop),
          disabled: isUpdating,
          style: _ref11 => {
            var pressed = _ref11.pressed;
            return [primaryOnly ? styles.primaryActionButton : styles.stopPrimaryActionButton, pressed && styles.buttonPressed];
          },
          children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: primaryOnly ? styles.primaryActionText : styles.stopPrimaryActionText,
            children: isUpdating ? 'Syncing...' : primaryLabel
          })
        }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
          onPress: () => openStopDeliveryNotes(stop),
          disabled: isUpdating,
          style: _ref12 => {
            var pressed = _ref12.pressed;
            return [primaryOnly ? styles.secondaryActionButton : styles.stopActionButton, pressed && styles.buttonPressed];
          },
          children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: primaryOnly ? styles.secondaryActionText : styles.stopActionText,
            children: "Notes & Photos"
          })
        }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
          onPress: () => promptNoDeliveryReason(stop),
          disabled: isUpdating,
          style: _ref13 => {
            var pressed = _ref13.pressed;
            return [primaryOnly ? styles.noDeliveryActionButton : styles.stopNoDeliveryButton, pressed && styles.buttonPressed];
          },
          children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: primaryOnly ? styles.noDeliveryActionText : styles.stopNoDeliveryText,
            children: "No Delivery"
          })
        })]
      });
    };
    if (isLoading) {
      return /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNativeSafeAreaContext.SafeAreaView, {
        style: styles.container,
        children: /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
          style: styles.loadingWrap,
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.ActivityIndicator, {
            size: "large",
            color: "#72f6ff"
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: styles.loadingText,
            children: "Loading assigned route..."
          })]
        })
      });
    }
    return /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNativeSafeAreaContext.SafeAreaView, {
      style: styles.container,
      children: /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.ScrollView, {
        contentContainerStyle: styles.content,
        onScroll: event => _reactNative.DeviceEventEmitter.emit('driver-settings-scroll', event.nativeEvent.contentOffset.y),
        scrollEventThrottle: 16,
        children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
          style: styles.headerRow,
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
            onPress: () => navigation.navigate('Home'),
            style: _ref14 => {
              var pressed = _ref14.pressed;
              return [styles.backButton, pressed && styles.buttonPressed];
            },
            children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.backButtonText,
              children: '< Back'
            })
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
            onPress: () => loadAssignedRoute({
              quiet: true
            }),
            disabled: isRefreshing,
            style: _ref15 => {
              var pressed = _ref15.pressed;
              return [styles.refreshButton, pressed && styles.buttonPressed];
            },
            children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.refreshButtonText,
              children: isRefreshing ? 'Refreshing' : 'Refresh'
            })
          })]
        }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
          style: styles.kicker,
          children: "Assigned Driver Route"
        }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
          style: styles.driverName,
          children: confirmedDriverName || confirmedDriverId
        }), !!error && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
          style: styles.errorCard,
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: styles.errorTitle,
            children: "Route unavailable"
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: styles.errorText,
            children: error
          })]
        }), !error && !routeManifest && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
          style: styles.emptyCard,
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: styles.emptyTitle,
            children: "No route assigned"
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
            style: styles.emptyText,
            children: "There is no assigned route for you."
          })]
        }), !!routeManifest && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactJsxRuntime.Fragment, {
          children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
            style: styles.summaryCard,
            children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.summaryTopRow,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                  style: styles.routeNumber,
                  children: ["Route ", routeManifest.routeNumber]
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.routeDate,
                  children: formatRouteDate(routeManifest.routeDate)
                })]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.routeStatus,
                children: routeManifest.status
              })]
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.metricGrid,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.metricTile,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricValue,
                  children: routeManifest.totalStops
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricLabel,
                  children: "Stops"
                })]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.metricTile,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricValue,
                  children: routeManifest.totalPallets
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricLabel,
                  children: "Pallets"
                })]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.metricTile,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricValue,
                  children: routeManifest.totalCases
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.metricLabel,
                  children: "Cases"
                })]
              })]
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.routeWindowRow,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.routeWindowLabel,
                children: "Route window"
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                style: styles.routeWindowValue,
                children: [formatScheduledTime(routeManifest.plannedStartAt), " - ", formatScheduledTime(routeManifest.plannedEndAt)]
              })]
            }), !!routeManifest.inventoryReconciliation && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.inventorySummary,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.inventorySummaryTitle,
                children: "Load accountability"
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                style: styles.inventorySummaryText,
                children: [routeManifest.inventoryReconciliation.deliveredQuantity || 0, " sold", ' | ', routeManifest.inventoryReconciliation.returnedQuantity || 0, " returned", ' | ', routeManifest.inventoryReconciliation.damagedQuantity || 0, " damaged", ' | ', routeManifest.inventoryReconciliation.missingQuantity || 0, " missing"]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                style: [styles.inventorySummaryBalance, routeManifest.inventoryReconciliation.unaccountedQuantity > 0 && styles.inventorySummaryWarning],
                children: [routeManifest.inventoryReconciliation.unaccountedQuantity || 0, " units unaccounted"]
              })]
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.View, {
              style: styles.progressBar,
              children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.View, {
                style: [styles.progressFill, {
                  width: `${stops.length ? Math.round(completedStops / stops.length * 100) : 0}%`
                }]
              })
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
              style: styles.progressText,
              children: [completedStops, " of ", stops.length, " stops completed"]
            }), stops.length > 0 && completedStops === stops.length && isDriverReceiptWindowOpen(routeManifest.completedAt) && /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
              onPress: printRouteCloseout,
              disabled: isPrintingCloseout,
              style: _ref16 => {
                var pressed = _ref16.pressed;
                return [styles.closeoutButton, pressed && styles.buttonPressed];
              },
              children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.closeoutButtonText,
                children: isPrintingCloseout ? 'Sending to Printer...' : 'Print Route Turn-In Receipt'
              })
            }), stops.length > 0 && completedStops === stops.length && /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
              onPress: openFinalInventoryCloseout,
              style: styles.inventoryCloseoutButton,
              children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.inventoryCloseoutButtonText,
                children: "Final Inventory Inspection"
              })
            }), stops.length > 0 && completedStops === stops.length && !isDriverReceiptWindowOpen(routeManifest.completedAt) && /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.progressText,
              children: "The driver reprint window has ended. Contact a supervisor for the retained route receipt."
            })]
          }), !!nextStop && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
            style: styles.nextStopCard,
            children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.nextStopKicker,
              children: "Next Stop"
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.nextStopTitle,
              children: nextStop.accountName || nextStop.destinationAddress
            }), !!nextStop.accountNumber && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
              style: styles.nextStopAccount,
              children: ["Account #", nextStop.accountNumber]
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.nextStopAddress,
              children: buildStopAddress(nextStop)
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.nextStopMetrics,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                style: styles.nextStopMetric,
                children: [nextStop.palletCount, " pallets"]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                style: styles.nextStopMetric,
                children: [nextStop.caseCount, " cases"]
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.nextStopMetric,
                children: formatStopWindow(nextStop)
              })]
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(AccountKnowledgePanel.default, {
              accountNumber: nextStop.accountNumber,
              destination: buildStopAddress(nextStop),
              routeManifestId: routeManifest?.id,
              routeStopId: nextStop.id,
              routeDate: routeManifest?.routeDate,
              routeNumber: routeManifest?.routeNumber,
              driverId: confirmedDriverId,
              driverName: confirmedDriverName,
              compact: true,
              onOpen: () => openStopDeliveryNotes(nextStop)
            }), renderLifecycleActions(nextStop, {
              primaryOnly: true
            })]
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
            style: styles.copilotCard,
            children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.copilotKicker,
              children: "Driver Copilot"
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.copilotTitle,
              children: "Ask about this route or stop"
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.TextInput, {
              value: copilotQuestion,
              onChangeText: setCopilotQuestion,
              placeholder: "Example: What should I know before this stop?",
              placeholderTextColor: "rgba(255,255,255,0.55)",
              style: styles.copilotInput,
              multiline: true
            }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Pressable, {
              onPress: askCopilot,
              disabled: isCopilotLoading,
              style: _ref17 => {
                var pressed = _ref17.pressed;
                return [styles.copilotButton, pressed && styles.buttonPressed, isCopilotLoading && styles.copilotButtonDisabled];
              },
              children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.copilotButtonText,
                children: isCopilotLoading ? 'Asking...' : 'Ask Copilot'
              })
            }), !!copilotError && /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.copilotError,
              children: copilotError
            }), !!copilotAnswer && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
              style: styles.copilotAnswerBox,
              children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.copilotAnswerTitle,
                children: copilotAnswer.title || 'Copilot answer'
              }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                style: styles.copilotAnswerText,
                children: copilotAnswer.answer
              }), Array.isArray(copilotAnswer.driverActions) && copilotAnswer.driverActions.length > 0 && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.copilotListBlock,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.copilotListTitle,
                  children: "Driver actions"
                }), copilotAnswer.driverActions.map((item, index) => /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.copilotListItem,
                  children: `\u2022 ${item}`
                }, `copilot-action-${index}`))]
              }), Array.isArray(copilotAnswer.safetyNotes) && copilotAnswer.safetyNotes.length > 0 && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.copilotListBlock,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.copilotListTitle,
                  children: "Safety notes"
                }), copilotAnswer.safetyNotes.map((item, index) => /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.copilotListItem,
                  children: `\u2022 ${item}`
                }, `copilot-safety-${index}`))]
              })]
            })]
          }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
            style: styles.stopList,
            children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
              style: styles.stopListTitle,
              children: "Stop Manifest"
            }), stops.map(stop => {
              return /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                style: styles.stopCard,
                children: [/*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                  style: styles.stopHeaderRow,
                  children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.View, {
                    style: styles.stopNumberBadge,
                    children: /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                      style: styles.stopNumberText,
                      children: stop.stopSequence
                    })
                  }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                    style: styles.stopTitleWrap,
                    children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                      style: styles.stopTitle,
                      numberOfLines: 1,
                      children: stop.accountName || stop.destinationAddress
                    }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                      style: styles.stopSubtitle,
                      numberOfLines: 1,
                      children: stop.accountNumber ? `Acct ${stop.accountNumber}` : buildStopAddress(stop)
                    })]
                  }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                    style: styles.stopStatus,
                    children: getStopStatusLabel(stop.status)
                  })]
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                  style: styles.stopAddress,
                  children: buildStopAddress(stop)
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                  style: styles.stopDetailRow,
                  children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                    style: styles.stopDetail,
                    children: formatStopWindow(stop)
                  }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                    style: styles.stopDetail,
                    children: [stop.palletCount, " pallets"]
                  }), /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.Text, {
                    style: styles.stopDetail,
                    children: [stop.caseCount, " cases"]
                  })]
                }), !!getNonDeliveryReasonLabel(stop.nonDeliveryReason) && /*#__PURE__*/(0, _reactJsxRuntime.jsxs)(_reactNative.View, {
                  style: styles.noDeliveryReasonCard,
                  children: [/*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                    style: styles.noDeliveryReasonTitle,
                    children: "No delivery reason"
                  }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(_reactNative.Text, {
                    style: styles.noDeliveryReasonText,
                    children: getNonDeliveryReasonLabel(stop.nonDeliveryReason)
                  })]
                }), /*#__PURE__*/(0, _reactJsxRuntime.jsx)(AccountKnowledgePanel.default, {
                  accountNumber: stop.accountNumber,
                  destination: buildStopAddress(stop),
                  routeManifestId: routeManifest?.id,
                  routeStopId: stop.id,
                  routeDate: routeManifest?.routeDate,
                  routeNumber: routeManifest?.routeNumber,
                  driverId: confirmedDriverId,
                  driverName: confirmedDriverName,
                  compact: true,
                  onOpen: () => openStopDeliveryNotes(stop)
                }), renderLifecycleActions(stop)]
              }, stop.id);
            })]
          })]
        })]
      })
    });
  }
  var styles = _reactNative.StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#07131f'
    },
    content: {
      padding: 16,
      paddingBottom: 34
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12
    },
    loadingText: {
      color: '#d7f7ff',
      fontSize: 15,
      fontWeight: '800'
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18
    },
    backButton: {
      minHeight: 42,
      borderRadius: 21,
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)'
    },
    backButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '900'
    },
    refreshButton: {
      minHeight: 42,
      marginTop: 52,
      borderRadius: 21,
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: 'rgba(114,246,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(114,246,255,0.28)'
    },
    refreshButtonText: {
      color: '#72f6ff',
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    buttonPressed: {
      opacity: 0.78
    },
    kicker: {
      color: '#72f6ff',
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    driverName: {
      marginTop: 4,
      marginBottom: 16,
      color: '#ffffff',
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '900'
    },
    errorCard: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: 'rgba(210, 40, 40, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255, 120, 120, 0.34)'
    },
    errorTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900'
    },
    errorText: {
      marginTop: 6,
      color: '#ffd7d7',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700'
    },
    emptyCard: {
      minHeight: 260,
      borderRadius: 24,
      padding: 22,
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)'
    },
    emptyTitle: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '900'
    },
    emptyText: {
      marginTop: 10,
      color: '#c7d4df',
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '700'
    },
    driverIdText: {
      marginTop: 16,
      color: '#72f6ff',
      fontSize: 13,
      fontWeight: '900'
    },
    summaryCard: {
      borderRadius: 26,
      padding: 18,
      backgroundColor: '#0e2634',
      borderWidth: 1,
      borderColor: 'rgba(114,246,255,0.18)'
    },
    closeoutButton: {
      marginTop: 15,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: '#d8a329',
      borderRadius: 5
    },
    closeoutButtonText: {
      color: '#101820',
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center'
    },
    inventoryCloseoutButton: {
      marginTop: 10,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: '#1b9c85',
      borderRadius: 5
    },
    inventoryCloseoutButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center'
    },
    summaryTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12
    },
    routeNumber: {
      color: '#ffffff',
      fontSize: 26,
      lineHeight: 31,
      fontWeight: '900'
    },
    routeDate: {
      marginTop: 3,
      color: '#c7d4df',
      fontSize: 14,
      fontWeight: '800'
    },
    routeStatus: {
      alignSelf: 'flex-start',
      overflow: 'hidden',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      color: '#102033',
      backgroundColor: '#72f6ff',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    metricGrid: {
      marginTop: 18,
      flexDirection: 'row',
      gap: 10
    },
    metricTile: {
      flex: 1,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.09)'
    },
    metricValue: {
      color: '#ffffff',
      fontSize: 25,
      fontWeight: '900'
    },
    metricLabel: {
      marginTop: 2,
      color: '#9feef5',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    routeWindowRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12
    },
    routeWindowLabel: {
      color: '#9fb2bf',
      fontSize: 13,
      fontWeight: '800'
    },
    routeWindowValue: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900'
    },
    inventorySummary: {
      marginTop: 14,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(114,246,179,0.28)'
    },
    inventorySummaryTitle: {
      color: '#72f6b3',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    inventorySummaryText: {
      marginTop: 5,
      color: '#d5e4ec',
      fontSize: 13,
      fontWeight: '800'
    },
    inventorySummaryBalance: {
      marginTop: 4,
      color: '#72f6b3',
      fontSize: 13,
      fontWeight: '900'
    },
    inventorySummaryWarning: {
      color: '#ff8f8f'
    },
    progressBar: {
      marginTop: 16,
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.12)'
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: '#40e683'
    },
    progressText: {
      marginTop: 8,
      color: '#c7d4df',
      fontSize: 12,
      fontWeight: '800'
    },
    nextStopCard: {
      marginTop: 16,
      borderRadius: 26,
      padding: 18,
      backgroundColor: '#7a1117',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)'
    },
    nextStopKicker: {
      color: '#ffd5d5',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    nextStopTitle: {
      marginTop: 5,
      color: '#ffffff',
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '900'
    },
    nextStopAccount: {
      marginTop: 4,
      color: '#ffd5d5',
      fontSize: 13,
      fontWeight: '900'
    },
    nextStopAddress: {
      marginTop: 8,
      color: '#ffe8e8',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700'
    },
    nextStopMetrics: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    nextStopMetric: {
      overflow: 'hidden',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.22)',
      fontSize: 12,
      fontWeight: '900'
    },
    nextStopActions: {
      marginTop: 16,
      flexDirection: 'row',
      gap: 10
    },
    secondaryActionButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.26)'
    },
    secondaryActionText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    primaryActionButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0d7f89',
      borderWidth: 1,
      borderColor: 'rgba(155, 241, 255, 0.52)'
    },
    primaryActionText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    noDeliveryActionButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 178, 66, 0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255, 198, 92, 0.46)'
    },
    noDeliveryActionText: {
      color: '#ffd47a',
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    copilotCard: {
      marginTop: 16,
      borderRadius: 24,
      padding: 16,
      backgroundColor: 'rgba(12, 62, 80, 0.76)',
      borderWidth: 1,
      borderColor: 'rgba(114,246,255,0.24)'
    },
    copilotKicker: {
      color: '#72f6ff',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    copilotTitle: {
      marginTop: 4,
      color: '#ffffff',
      fontSize: 20,
      lineHeight: 25,
      fontWeight: '900'
    },
    copilotInput: {
      marginTop: 12,
      minHeight: 78,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      textAlignVertical: 'top'
    },
    copilotButton: {
      marginTop: 12,
      minHeight: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#d62828',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)'
    },
    copilotButtonDisabled: {
      opacity: 0.62
    },
    copilotButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    copilotError: {
      marginTop: 10,
      color: '#ffd7d7',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800'
    },
    copilotAnswerBox: {
      marginTop: 14,
      borderRadius: 18,
      padding: 14,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)'
    },
    copilotAnswerTitle: {
      color: '#ffffff',
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '900'
    },
    copilotAnswerText: {
      marginTop: 8,
      color: '#d8e6ee',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700'
    },
    copilotListBlock: {
      marginTop: 12,
      gap: 5
    },
    copilotListTitle: {
      color: '#9feef5',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    copilotListItem: {
      color: '#f2fbff',
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700'
    },
    stopList: {
      marginTop: 18,
      gap: 12
    },
    stopListTitle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '900'
    },
    stopCard: {
      borderRadius: 22,
      padding: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)'
    },
    stopHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    stopNumberBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#d62828'
    },
    stopNumberText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900'
    },
    stopTitleWrap: {
      flex: 1
    },
    stopTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900'
    },
    stopSubtitle: {
      marginTop: 2,
      color: '#9fb2bf',
      fontSize: 12,
      fontWeight: '800'
    },
    stopStatus: {
      overflow: 'hidden',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 5,
      color: '#72f6ff',
      backgroundColor: 'rgba(114,246,255,0.12)',
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    stopAddress: {
      marginTop: 10,
      color: '#d8e6ee',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700'
    },
    stopDetailRow: {
      marginTop: 10,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    stopDetail: {
      color: '#9feef5',
      fontSize: 12,
      fontWeight: '900'
    },
    stopActions: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    finishedStopActions: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8
    },
    completedDetailsButton: {
      minHeight: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      backgroundColor: 'rgba(75, 205, 224, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(113, 232, 246, 0.35)'
    },
    completedDetailsButtonText: {
      color: '#b9f7ff',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    stopActionButton: {
      minHeight: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)'
    },
    stopPrimaryActionButton: {
      minHeight: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: '#0d7f89',
      borderWidth: 1,
      borderColor: 'rgba(114,246,255,0.36)'
    },
    stopActionText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    stopPrimaryActionText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    stopNoDeliveryButton: {
      minHeight: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255, 178, 66, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 198, 92, 0.34)'
    },
    stopNoDeliveryText: {
      color: '#ffd47a',
      fontSize: 11,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    noDeliveryReasonCard: {
      marginTop: 10,
      borderRadius: 14,
      padding: 10,
      backgroundColor: 'rgba(255, 178, 66, 0.13)',
      borderWidth: 1,
      borderColor: 'rgba(255, 198, 92, 0.28)'
    },
    noDeliveryReasonTitle: {
      color: '#ffd47a',
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    noDeliveryReasonText: {
      marginTop: 2,
      color: '#fff2cb',
      fontSize: 13,
      fontWeight: '800'
    },
    lifecycleCompletePill: {
      alignSelf: 'flex-start',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: 'rgba(64,230,131,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(64,230,131,0.32)'
    },
    lifecycleCompleteText: {
      color: '#7dffae',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    lifecycleUndeliveredPill: {
      backgroundColor: 'rgba(255,178,66,0.16)',
      borderColor: 'rgba(255,198,92,0.34)'
    },
    lifecycleUndeliveredText: {
      color: '#ffd47a'
    }
  });
