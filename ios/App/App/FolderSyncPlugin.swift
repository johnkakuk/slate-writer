import UIKit
import Capacitor
import UniformTypeIdentifiers

@objc(SlateBridgeViewController)
class SlateBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(FolderSyncPlugin()) }
}

@objc(FolderSyncPlugin)
public class FolderSyncPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderSyncPlugin"
    public let jsName = "FolderSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exchange", returnType: CAPPluginReturnPromise)
    ]
    private let bookmarkKey = "slate.sync.folder.bookmark.v1"
    private let queue = DispatchQueue(label: "slate.folder-sync")
    private var pickerCall: CAPPluginCall?
    private func resolveFolder() throws -> URL? {
        guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { return nil }
        var stale = false
        let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale {
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            UserDefaults.standard.set(try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil), forKey: bookmarkKey)
        }
        return url
    }
    private func info(_ url: URL?) -> [String: Any] {
        guard let url = url else { return ["folder": NSNull(), "deviceName": UIDevice.current.name] }
        return ["folder": url.path, "deviceName": UIDevice.current.name]
    }
    @objc func getFolder(_ call: CAPPluginCall) {
        do { call.resolve(info(try resolveFolder())) } catch { call.reject("Choose your sync folder again: " + error.localizedDescription) }
    }
    @objc func pickFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil else { call.reject("A folder picker is already open"); return }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        defer { pickerCall = nil }
        guard let url = urls.first else { pickerCall?.resolve(["cancelled": true]); return }
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmark, forKey: bookmarkKey)
            pickerCall?.resolve(info(url))
        } catch { pickerCall?.reject(error.localizedDescription) }
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.resolve(["cancelled": true]); pickerCall = nil
    }
    @objc func disconnect(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: bookmarkKey); call.resolve()
    }
    @objc func exchange(_ call: CAPPluginCall) {
        queue.async {
            do {
                guard let url = try self.resolveFolder() else { call.reject("No sync folder selected"); return }
                let accessing = url.startAccessingSecurityScopedResource()
                defer { if accessing { url.stopAccessingSecurityScopedResource() } }
                let request: [String: Any] = ["known": call.getArray("known", String.self) ?? [],
                    "records": call.getArray("records", JSObject.self) ?? [], "presence": call.getObject("presence") ?? [:],
                    "includeLegacy": call.getBool("includeLegacy") ?? false]
                call.resolve(try FolderSyncStore(root: url).exchange(request))
            } catch { call.reject(error.localizedDescription) }
        }
    }
}
