import Foundation

// Shared by the iOS plugin and the macOS helper. File coordination is local;
// immutable revisions and causal parents handle changes arriving from other devices.
final class FolderSyncStore {
    let root: URL
    init(root: URL) { self.root = root }
    func coordinated<T>(_ url: URL, writing: Bool = false, _ work: (URL) throws -> T) throws -> T {
        var coordinationError: NSError?
        var result: Result<T, Error>?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        if writing {
            coordinator.coordinate(writingItemAt: url, options: [], error: &coordinationError) { target in result = Result { try work(target) } }
        } else {
            coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { target in result = Result { try work(target) } }
        }
        if let error = coordinationError { throw error }
        guard let result = result else { throw failure("The sync folder is unavailable") }
        return try result.get()
    }
    func failure(_ message: String) -> NSError { NSError(domain: "SlateFolderSync", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    func requestDownload(_ url: URL) throws {
        let values = try url.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
        if values.isUbiquitousItem == true && values.ubiquitousItemDownloadingStatus != .current {
            try FileManager.default.startDownloadingUbiquitousItem(at: url)
        }
    }
    func read(_ url: URL) throws -> String {
        try requestDownload(url)
        return try coordinated(url) { try String(contentsOf: $0, encoding: .utf8) }
    }
    func directory(_ name: String) throws -> URL {
        let url = root.appendingPathComponent(name, isDirectory: true)
        try coordinated(root, writing: true) { _ in
            var isDirectory: ObjCBool = false
            if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory) {
                guard isDirectory.boolValue else { throw failure("A file is using the sync directory's name") }
            } else {
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false)
            }
        }
        return url
    }
    func files(_ url: URL) throws -> [URL] {
        try requestDownload(url)
        let items = try coordinated(url) { try FileManager.default.contentsOfDirectory(at: $0,
            includingPropertiesForKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey], options: []) }
        // Ask the provider to hydrate evicted entries before filtering extensions.
        // Older providers can expose their download placeholders as hidden items.
        for item in items { try requestDownload(item) }
        return items.filter { !$0.lastPathComponent.hasPrefix(".") }
    }
    func safeId(_ id: String) throws {
        guard id.range(of: "^[A-Za-z0-9_-]{1,100}$", options: .regularExpression) != nil else { throw failure("Invalid revision identifier") }
    }
    func exchange(_ request: [String: Any]) throws -> [String: Any] {
        let revisions = try directory("Slate Revisions")
        let devices = try directory("Slate Devices")
        for item in request["records"] as? [[String: String]] ?? [] {
            guard let id = item["id"], let json = item["json"] else { throw failure("Invalid revision") }
            try safeId(id)
            let url = revisions.appendingPathComponent(id + ".json")
            try coordinated(url, writing: true) { target in
                if FileManager.default.fileExists(atPath: target.path) {
                    guard try String(contentsOf: target, encoding: .utf8) == json else { throw failure("A revision file was changed outside Slate. The local original is safe.") }
                } else { try Data(json.utf8).write(to: target, options: .atomic) }
            }
        }
        if let marker = request["presence"] as? [String: Any], let id = marker["device"] as? String {
            try safeId(id)
            let data = try JSONSerialization.data(withJSONObject: marker, options: [.sortedKeys])
            try coordinated(devices.appendingPathComponent(id + ".json"), writing: true) { try data.write(to: $0, options: .atomic) }
        }
        let known = Set(request["known"] as? [String] ?? [])
        var records = [String](), present = [String](), leases = [String](), legacy = [String]()
        for url in try files(revisions) where url.pathExtension == "json" {
            let id = url.deletingPathExtension().lastPathComponent
            present.append(id)
            if !known.contains(id) { records.append(try read(url)) }
            // Preserve any provider conflict versions as additional input, never delete them.
            for version in NSFileVersion.unresolvedConflictVersionsOfItem(at: url) ?? [] { records.append(try read(version.url)) }
        }
        for url in try files(devices) where url.pathExtension == "json" { leases.append(try read(url)) }
        if request["includeLegacy"] as? Bool == true {
            for url in try files(root) where url.pathExtension == "slatewriter" { legacy.append(try read(url)) }
        }
        return ["records": records, "present": present, "leases": leases, "legacy": legacy]
    }
}
