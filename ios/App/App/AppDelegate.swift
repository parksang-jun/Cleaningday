import UIKit
import Capacitor
import GameKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - 랭킹 (Game Center)
//  웹 쪽 src/leaderboard.ts 가 부르는 앱 내장 플러그인. 파일을 따로 만들지 않고 여기 둔 것은
//  Xcode 프로젝트 파일(project.pbxproj)에 새 파일을 등록하지 않아도 되게 하기 위해서다.

/// 스토리보드(Main.storyboard)의 루트 화면. 내장 플러그인을 브리지에 등록한다.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LeaderboardPlugin())
    }
}

@objc(LeaderboardPlugin)
public class LeaderboardPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "LeaderboardPlugin"
    public let jsName = "Leaderboard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    /// Game Center 가 넘겨준 로그인 화면. 조용한 로그인(interactive=false)에서는 띄우지 않고 보관만 한다.
    private var pendingLogin: UIViewController?
    private var handlerInstalled = false

    @objc func signIn(_ call: CAPPluginCall) {
        let interactive = call.getBool("interactive") ?? false
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["signedIn": true])
                return
            }
            if self.handlerInstalled {
                // 핸들러는 한 번만 설치할 수 있다. 보관해 둔 로그인 화면이 있으면 사용자가 요청했을 때 띄운다.
                if interactive, let login = self.pendingLogin, let host = self.bridge?.viewController {
                    self.pendingLogin = nil
                    host.present(login, animated: true)
                }
                call.resolve(["signedIn": false])
                return
            }
            self.handlerInstalled = true
            var answered = false
            player.authenticateHandler = { [weak self] login, _ in
                DispatchQueue.main.async {
                    if let login = login {
                        if interactive, !answered, let host = self?.bridge?.viewController {
                            host.present(login, animated: true)
                        } else {
                            self?.pendingLogin = login
                        }
                    }
                    if !answered {
                        answered = true
                        call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated])
                    }
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("not signed in")
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [id]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        guard let id = call.getString("leaderboardId") else {
            call.reject("leaderboardId is required")
            return
        }
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, let host = self.bridge?.viewController else {
                call.reject("not signed in")
                return
            }
            let board = GKGameCenterViewController(leaderboardID: id, playerScope: .global, timeScope: .allTime)
            board.gameCenterDelegate = self
            host.present(board, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
