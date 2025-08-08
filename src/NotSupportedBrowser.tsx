import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "./components/ui/alert-dialog";



export default function NotSupportedBrowser() {


    return <AlertDialog open>
        <AlertDialogContent>
            <AlertDialogTitle>
                Unsupported browser
            </AlertDialogTitle>
            <AlertDialogDescription>
This app requires a Chromium-based browser with the File System Access API (Chrome, Edge, Brave, Arc). Please switch to a supported browser.
            </AlertDialogDescription>
        </AlertDialogContent>
    </AlertDialog>
    
    
}