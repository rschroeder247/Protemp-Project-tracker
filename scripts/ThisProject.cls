VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "ThisProject"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
Option Explicit

' =========================================================================
' Protemp Project Tracker: Automatic Project Events for Master Project.mpp
'
' 1. Project_Open:
'    Fires automatically every time the project file is opened.
'    Pulls latest completed site stages from the Web Tracker, marks them 100%
'    complete, and adds the technician's name to the Task Notes.
'
' 2. Project_BeforeSave:
'    Fires automatically before saving. (Optional auto-push).
' =========================================================================

Private Sub Project_Open(ByVal pj As Project)
    On Error Resume Next
    ' Automatically pull latest site progress from the cloud when opened
    PullSiteProgressIntoMSProject isSilent:=True
End Sub



