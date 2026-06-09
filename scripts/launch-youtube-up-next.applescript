on run
	set browserPath to "/Applications/Chromium.app"
	set appBundle to POSIX path of (path to me)
	set extensionDir to appBundle & "Contents/Resources/extension"
	set profileDir to (POSIX path of (path to home folder)) & "Library/Application Support/YouTube Up Next Chromium"
	set targetUrl to "https://www.youtube.com/"
	set windowSize to "1600,900"
	set windowPosition to "80,60"
	
	do shell script "mkdir -p " & quoted form of profileDir
	do shell script "open -na " & quoted form of browserPath & " --args --user-data-dir=" & quoted form of profileDir & " --disable-extensions-except=" & quoted form of extensionDir & " --load-extension=" & quoted form of extensionDir & " --no-first-run --no-default-browser-check --window-size=" & quoted form of windowSize & " --window-position=" & quoted form of windowPosition & " --app=" & quoted form of targetUrl
end run
