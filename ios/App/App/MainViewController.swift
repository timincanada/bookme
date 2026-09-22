import UIKit
import StoreKit
import Capacitor

/// Bridge view controller that registers app-local plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorefrontPlugin())
    }
}

/// Reports the App Store storefront country (ISO 3166-1 alpha-3, e.g. "USA").
/// Used only to decide whether the US-only external account link may be shown.
@objc(StorefrontPlugin)
public class StorefrontPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorefrontPlugin"
    public let jsName = "Storefront"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCountry", returnType: CAPPluginReturnPromise)
    ]

    @objc func getCountry(_ call: CAPPluginCall) {
        Task {
            let code = await Storefront.current?.countryCode
            call.resolve(["countryCode": code ?? NSNull()])
        }
    }
}
