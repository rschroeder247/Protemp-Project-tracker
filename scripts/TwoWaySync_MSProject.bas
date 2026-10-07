Attribute VB_Name = "TwoWaySync_MSProject"
Option Explicit

' =========================================================================
' Protemp Project Tracker: Two-Way Synchronization Bridge
'
' 1. PushMasterProjectToWebTracker()
'    Sends Master Project + Subprojects WBS hierarchy to the Web Tracker
'
' 2. PullSiteProgressIntoMSProject()
'    Fetches locked stages from the site team, sets % Complete to 100%,
'    records technician name in Text1/Notes, and saves all original subprojects.
'
' 3. BackupXmlWithRotation()
'    Maintains rolling 4 backups of Master Project.xml in \Backups\ folder
'    before overwriting.
' =========================================================================

Private Const API_BASE_URL As String = "https://protemp-project-tracker.vercel.app"
Private Const SYNC_API_KEY As String = "pt_sync_sec_2026_9824"
Private Const RELATIVE_MASTER_PATH As String = "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.mpp"
Private Const RELATIVE_XML_PATH As String = "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.xml"

Public IsExportingXml As Boolean

Public Function GetMasterProjectPath() As String
    GetMasterProjectPath = Environ$("USERPROFILE") & RELATIVE_MASTER_PATH
End Function

Public Function GetMasterXmlPath() As String
    GetMasterXmlPath = Environ$("USERPROFILE") & RELATIVE_XML_PATH
End Function

' -------------------------------------------------------------------------
' SUBPROJECT PROPAGATION HELPER: Save all underlying original subprojects
' -------------------------------------------------------------------------
Public Sub SaveAllOpenSubprojects(Optional ByVal pj As Object = Nothing)
    On Error Resume Next
    
    ' 1. Application-level FileSaveAll
    Application.FileSaveAll
    
    ' 2. Iterate through all open projects in the MS Project application
    Dim p As Object
    For Each p In Application.Projects
        If Not p Is Nothing Then
            If Not p.ReadOnly Then
                p.Save
            End If
        End If
    Next p
    
    ' 3. Explicitly iterate through linked Subprojects of ActiveProject and save SourceProjects
    Dim activeProj As Object
    Set activeProj = IIf(pj Is Nothing, Application.ActiveProject, pj)
    
    If Not activeProj Is Nothing Then
        Dim sp As Object
        For Each sp In activeProj.Subprojects
            If Not sp Is Nothing Then
                If Not sp.SourceProject Is Nothing Then
                    If Not sp.SourceProject.ReadOnly Then
                        sp.SourceProject.Save
                    End If
                End If
            End If
        Next sp
    End If
End Sub

' -------------------------------------------------------------------------
' ROLLING XML BACKUP ROTATION: Keep 4 newest backups and delete older
' -------------------------------------------------------------------------
Public Sub BackupXmlWithRotation(ByVal xmlPath As String, Optional ByVal maxBackups As Integer = 4)
    On Error Resume Next
    If Dir$(xmlPath) = "" Then Exit Sub
    
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    If fso Is Nothing Then Exit Sub
    
    Dim parentFolder As String
    parentFolder = fso.GetParentFolderName(xmlPath)
    Dim backupFolder As String
    backupFolder = fso.BuildPath(parentFolder, "Backups")
    
    If Not fso.FolderExists(backupFolder) Then
        fso.CreateFolder backupFolder
    End If
    
    ' 1. Create timestamped backup of the current XML file before overwriting
    Dim timestamp As String
    timestamp = Format$(Now, "yyyymmdd_hhnnss")
    Dim backupName As String
    backupName = "Master Project_backup_" & timestamp & ".xml"
    Dim backupPath As String
    backupPath = fso.BuildPath(backupFolder, backupName)
    
    fso.CopyFile xmlPath, backupPath, True
    
    ' 2. Enforce rolling retention: keep only the newest maxBackups (4) files
    Dim oFolder As Object
    Set oFolder = fso.GetFolder(backupFolder)
    Dim oFile As Object
    Dim fileCount As Long
    fileCount = 0
    
    For Each oFile In oFolder.Files
        If LCase$(fso.GetExtensionName(oFile.Name)) = "xml" And _
           InStr(1, oFile.Name, "Master Project_backup_", vbTextCompare) > 0 Then
            fileCount = fileCount + 1
        End If
    Next oFile
    
    While fileCount > maxBackups
        Dim oldestFile As Object
        Set oldestFile = Nothing
        Dim oldestDate As Date
        oldestDate = Now + 100
        
        For Each oFile In oFolder.Files
            If LCase$(fso.GetExtensionName(oFile.Name)) = "xml" And _
               InStr(1, oFile.Name, "Master Project_backup_", vbTextCompare) > 0 Then
                If oFile.DateLastModified < oldestDate Then
                    oldestDate = oFile.DateLastModified
                    Set oldestFile = oFile
                End If
            End If
        Next oFile
        
        If Not oldestFile Is Nothing Then
            oldestFile.Delete True
            fileCount = fileCount - 1
        Else
            Exit While
        End If
    Wend
End Sub

' -------------------------------------------------------------------------
' DIRECTION 0: Auto-Save XML when Project is Saved (with rolling backup & subprojects update)
' -------------------------------------------------------------------------
Public Sub AutoExportProjectToXml(Optional ByVal pj As Object = Nothing, Optional ByVal isSilent As Boolean = True)
    On Error GoTo EH
    If IsExportingXml Then Exit Sub
    IsExportingXml = True
    
    If Application.Projects.Count = 0 Then GoTo CleanUp
    
    Dim activeProj As Object
    Set activeProj = IIf(pj Is Nothing, Application.ActiveProject, pj)
    
    Dim userProfile As String
    userProfile = Environ$("USERPROFILE")
    
    Dim mppPath As String
    mppPath = userProfile & "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.mpp"
    
    Dim xmlPath As String
    xmlPath = userProfile & "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.xml"
    
    ' 1. Keep rolling 4 backups before overwriting existing XML
    BackupXmlWithRotation xmlPath, 4
    
    ' 2. Ensure all tasks and subprojects are expanded so XML export captures full subproject trees
    On Error Resume Next
    activeProj.OutlineShowAllTasks
    On Error GoTo EH
    
    ' 3. Suppress overwrite dialog so saving is completely seamless
    Application.DisplayAlerts = False
    
    ' Export XML format
    Application.FileSaveAs Name:=xmlPath, FormatID:="MSProject.XML"
    
    ' If FileSaveAs switched the active project to XML, re-open the MPP
    If LCase$(Right$(Application.ActiveProject.Name, 4)) = ".xml" Then
        Application.FileCloseEx Save:=pjDoNotSave
        If Dir(mppPath) <> "" Then
            Application.FileOpenEx Name:=mppPath
        End If
    End If
    
    ' 4. Ensure original subprojects are also saved
    SaveAllOpenSubprojects pj:=activeProj
    
    ' Update status bar
    On Error Resume Next
    Application.StatusBar = "Protemp Tracker: Auto-saved XML (backup preserved) to " & xmlPath
    On Error GoTo EH
    
    If Not isSilent Then
        MsgBox "Successfully exported to XML (with rolling backup):" & vbCrLf & xmlPath, vbInformation, "Auto-Export Complete"
    End If

CleanUp:
    On Error Resume Next
    Application.DisplayAlerts = True
    IsExportingXml = False
    Exit Sub

EH:
    On Error Resume Next
    Application.DisplayAlerts = True
    IsExportingXml = False
    If Not isSilent Then
        MsgBox "Notice: Could not automatically save XML: " & Err.Description, vbExclamation, "XML Export Warning"
    End If
End Sub

' -------------------------------------------------------------------------
' 1-CLICK SAVE & EXPORT (Self-Contained: assign to Quick Access Toolbar or Ribbon)
' -------------------------------------------------------------------------
Public Sub SaveMasterAndExportXml()
    On Error GoTo EH
    
    If Application.Projects.Count = 0 Then
        MsgBox "No project is currently open in Microsoft Project.", vbExclamation
        Exit Sub
    End If
    
    ' 1. Save standard MPP and all subprojects first
    On Error Resume Next
    SaveAllOpenSubprojects
    Application.ActiveProject.Save
    On Error GoTo EH
    
    ' 2. Determine paths directly
    Dim userProfile As String
    userProfile = Environ$("USERPROFILE")
    
    Dim mppPath As String
    mppPath = userProfile & "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.mpp"
    
    Dim xmlPath As String
    xmlPath = userProfile & "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.xml"
    
    ' 3. Backup existing XML (maintains rolling 4 backups)
    BackupXmlWithRotation xmlPath, 4
    
    ' 4. Expand all subprojects for complete export
    On Error Resume Next
    Application.ActiveProject.OutlineShowAllTasks
    On Error GoTo EH
    
    ' 5. Export XML copy
    Application.DisplayAlerts = False
    Application.FileSaveAs Name:=xmlPath, FormatID:="MSProject.XML"
    
    ' 6. Ensure user remains in MPP
    If LCase$(Right$(Application.ActiveProject.Name, 4)) = ".xml" Then
        Application.FileCloseEx Save:=pjDoNotSave
        If Dir(mppPath) <> "" Then
            Application.FileOpenEx Name:=mppPath
        End If
    End If
    Application.DisplayAlerts = True
    
    ' 7. Also save all subprojects
    SaveAllOpenSubprojects
    
    On Error Resume Next
    Application.StatusBar = "Protemp Tracker: Saved MPP, updated subprojects & exported XML to " & xmlPath
    MsgBox "Saved Master Project, updated all original subprojects, and exported XML!" & vbCrLf & vbCrLf & _
           "Backup saved to: Backups\ (keeping 4 newest backups)." & vbCrLf & _
           "File: " & xmlPath, vbInformation, "Protemp Tracker Sync"
    Exit Sub

EH:
    On Error Resume Next
    Application.DisplayAlerts = True
    MsgBox "Error saving and exporting XML: " & Err.Description, vbCritical
End Sub

' -------------------------------------------------------------------------
' DIRECTION 1: Push MS Project tasks -> Web Tracker
' -------------------------------------------------------------------------
Public Sub PushMasterProjectToWebTracker(Optional ByVal isSilent As Boolean = False)
    On Error GoTo EH
    
    Dim pj As Object
    On Error Resume Next
    Set pj = GetObject(, "MSProject.Application")
    If pj Is Nothing Then
        Set pj = CreateObject("MSProject.Application")
    End If
    On Error GoTo EH
    
    If pj Is Nothing Then
        If Not isSilent Then MsgBox "Microsoft Project is not open.", vbCritical
        Exit Sub
    End If
    
    If pj.Projects.Count = 0 Then
        Dim masterPath As String
        masterPath = GetMasterProjectPath()
        If Dir(masterPath) <> "" Then
            pj.FileOpenEx masterPath, ReadOnly:=True
        Else
            If Not isSilent Then
                MsgBox "Please open your MS Project file before running this sync." & vbCrLf & _
                       "Could not find default file at: " & masterPath, vbExclamation
            End If
            Exit Sub
        End If
    End If
    
    ' Also ensure original subprojects are saved
    SaveAllOpenSubprojects pj:=pj
    
    ' Also ensure the local XML copy is fresh and backed up
    AutoExportProjectToXml pj:=pj, isSilent:=True
    
    Dim tasksCollection As Object
    Set tasksCollection = pj.ActiveProject.Tasks
    
    If tasksCollection.Count = 0 Then
        If Not isSilent Then MsgBox "No tasks found in active project.", vbExclamation
        Exit Sub
    End If
    
    Dim json As String
    json = "{""projectName"": """ & CleanJson(pj.ActiveProject.Name) & """, ""tasks"": ["
    
    Dim t As Object
    Dim isFirst As Boolean
    isFirst = True
    Dim taskCount As Long
    taskCount = 0
    
    Dim currentSubproject As String
    currentSubproject = pj.ActiveProject.Name
    
    For Each t In tasksCollection
        If Not t Is Nothing Then
            taskCount = taskCount + 1
            If Not isFirst Then json = json & ","
            isFirst = False
            
            Dim subProj As String
            subProj = ""
            On Error Resume Next
            subProj = t.Subproject
            On Error GoTo EH
            If Len(subProj) = 0 Then subProj = currentSubproject
            
            Dim quotedHrs As Double
            quotedHrs = 0
            On Error Resume Next
            quotedHrs = Round(t.Work / 60#, 2)
            On Error GoTo EH
            
            Dim durDays As Double
            durDays = 0
            On Error Resume Next
            durDays = Round(t.Duration / 480#, 2)
            On Error GoTo EH
            
            Dim pctComp As Long
            pctComp = 0
            On Error Resume Next
            pctComp = CLng(t.PercentComplete)
            On Error GoTo EH
            
            Dim taskNotes As String
            taskNotes = ""
            On Error Resume Next
            taskNotes = CleanJson(t.Notes)
            On Error GoTo EH
            
            json = json & "{"
            json = json & """id"": """ & t.ID & ""","
            json = json & """uniqueId"": """ & t.UniqueID & ""","
            json = json & """wbs"": """ & t.WBS & ""","
            json = json & """outlineLevel"": " & t.OutlineLevel & ","
            json = json & """name"": """ & CleanJson(t.Name) & ""","
            json = json & """isSummary"": " & IIf(t.Summary, "true", "false") & ","
            json = json & """quotedHours"": " & Replace(Format(quotedHrs, "0.00"), ",", ".") & ","
            json = json & """durationDays"": " & Replace(Format(durDays, "0.00"), ",", ".") & ","
            json = json & """percentComplete"": " & pctComp & ","
            json = json & """notes"": """ & taskNotes & ""","
            json = json & """subprojectName"": """ & CleanJson(subProj) & """"
            json = json & "}"
        End If
    Next t
    
    json = json & "]}"
    
    ' Send HTTP POST to live endpoint
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "POST", API_BASE_URL & "/api/sync-project", False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "x-api-key", SYNC_API_KEY
    http.Send json
    
    If http.Status = 200 Then
        If Not isSilent Then
            MsgBox "Successfully synced " & taskCount & " tasks to the Web Tracker!" & vbCrLf & _
                   "The team on site can now view and tick the updated tasks.", vbInformation, "Sync Successful"
        End If
    Else
        If Not isSilent Then
            MsgBox "Sync error (" & http.Status & "): " & http.responseText, vbCritical, "Sync Failed"
        End If
    End If
    Exit Sub
    
EH:
    If Not isSilent Then
        MsgBox "Error pushing to tracker: " & Err.Description, vbCritical
    End If
End Sub

' -------------------------------------------------------------------------
' DIRECTION 2: Pull Site Progress -> MS Project & Update Subprojects
' -------------------------------------------------------------------------
Public Sub PullSiteProgressIntoMSProject(Optional ByVal isSilent As Boolean = False)
    On Error GoTo EH
    
    ' 1. Fetch completed tasks from API
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", API_BASE_URL & "/api/export-progress?format=json&apiKey=" & SYNC_API_KEY, False
    http.setRequestHeader "x-api-key", SYNC_API_KEY
    http.Send
    
    If http.Status <> 200 Then
        If Not isSilent Then
            MsgBox "Could not fetch site progress (" & http.Status & "): " & http.responseText, vbCritical
        End If
        Exit Sub
    End If
    
    Dim respText As String
    respText = http.responseText

    ' 2. Get active MS Project instance
    Dim pj As Object
    On Error Resume Next
    Set pj = GetObject(, "MSProject.Application")
    If pj Is Nothing Then
        Set pj = CreateObject("MSProject.Application")
    End If
    On Error GoTo EH
    
    If pj Is Nothing Then
        MsgBox "Microsoft Project is not open.", vbCritical
        Exit Sub
    End If
    
    If pj.Projects.Count = 0 Then
        Dim masterPathPull As String
        masterPathPull = GetMasterProjectPath()
        If Dir(masterPathPull) <> "" Then
            pj.FileOpenEx masterPathPull
        Else
            MsgBox "Please open your MS Project file before running this sync." & vbCrLf & _
                   "Could not find default file at: " & masterPathPull, vbExclamation
            Exit Sub
        End If
    End If
    
    ' 3. Parse tasks and update % Complete in MS Project
    Dim updatedCount As Long
    updatedCount = 0
    
    Dim t As Object
    For Each t In pj.ActiveProject.Tasks
        If Not t Is Nothing And Not t.Summary Then
            ' Check if this task's WBS is in the completed progress list
            Dim searchToken As String
            searchToken = """wbs"":""" & t.WBS & """"
            
            If InStr(respText, searchToken) > 0 Then
                ' Extract Done By name if present
                Dim doneBy As String
                doneBy = ExtractJsonVal(respText, searchToken, "doneByName")
                
                If t.PercentComplete < 100 Then
                    t.PercentComplete = 100
                    If Len(doneBy) > 0 Then
                        t.Text1 = doneBy
                        t.Notes = "Stage completed by " & doneBy & " on site."
                    End If
                    updatedCount = updatedCount + 1
                End If
            End If
        End If
    Next t
    
    ' 4. Save Master Project AND update all original subproject files
    On Error Resume Next
    SaveAllOpenSubprojects pj:=pj
    pj.Application.FileSaveAll
    pj.FileSave
    
    ' 5. Also export XML (with rolling 4-backup rotation)
    AutoExportProjectToXml pj:=pj, isSilent:=True
    
    If isSilent Then
        If updatedCount > 0 Then
            MsgBox "Protemp Auto-Sync Complete!" & vbCrLf & _
                   "Updated " & updatedCount & " task(s) to 100% complete in Master Project & all original subprojects.", _
                   vbInformation, "Site Progress Synced"
        Else
            On Error Resume Next
            pj.Application.StatusBar = "Protemp Tracker: Site progress is up to date in Master Project and subprojects."
        End If
    Else
        MsgBox "Pull Complete!" & vbCrLf & _
               "Updated " & updatedCount & " task(s) to 100% complete in Master Project & all original subprojects.", _
               vbInformation, "Site Progress Imported"
    End If
    Exit Sub
    
EH:
    If Not isSilent Then
        MsgBox "Error pulling site progress: " & Err.Description, vbCritical
    End If
End Sub


' --- JSON Helpers for VBA Late-Binding ---
Private Function CleanJson(ByVal s As String) As String
    s = Replace$(s, "\", "\\")
    s = Replace$(s, """", "\""")
    s = Replace$(s, vbCrLf, " ")
    s = Replace$(s, vbCr, " ")
    s = Replace$(s, vbLf, " ")
    s = Replace$(s, vbTab, " ")
    CleanJson = Trim$(s)
End Function

Private Function ExtractJsonVal(ByVal json As String, ByVal pivot As String, ByVal key As String) As String
    On Error Resume Next
    Dim pos1 As Long, pos2 As Long, pos3 As Long
    pos1 = InStr(json, pivot)
    If pos1 = 0 Then Exit Function
    
    pos2 = InStr(pos1, json, """" & key & """:""")
    If pos2 = 0 Or pos2 > pos1 + 250 Then Exit Function
    
    pos2 = pos2 + Len("""" & key & """:""")
    pos3 = InStr(pos2, json, """")
    If pos3 > pos2 Then
        ExtractJsonVal = Mid$(json, pos2, pos3 - pos2)
    End If
End Function
