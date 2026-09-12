import Foundation

@main struct FolderSyncHelper {
    static func main() {
        while let line = readLine() {
            do {
                guard let data = line.data(using: .utf8), let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let folder = request["folder"] as? String, folder.hasPrefix("/") else { throw NSError(domain: "Slate", code: 1) }
                let value = try FolderSyncStore(root: URL(fileURLWithPath: folder, isDirectory: true)).exchange(request)
                let output = try JSONSerialization.data(withJSONObject: ["result": value], options: [.sortedKeys])
                print(String(decoding: output, as: UTF8.self))
            } catch {
                let output = try! JSONSerialization.data(withJSONObject: ["error": error.localizedDescription])
                print(String(decoding: output, as: UTF8.self))
            }
            fflush(stdout)
        }
    }
}
