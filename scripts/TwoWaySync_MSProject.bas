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
'    and records who did the work in MS Project.
' =========================================================================

Private Const API_BASE_URL As String = "https://protemp-project-tracker.vercel.app"
Private Const RELATIVE_MASTER_PATH As String = "\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.mpp"

Private Function GetMasterProjectPath() As String
    GetMasterProjectPath = Environ$("USERPROFILE") & RELATIVE_MASTER_PATH
End Function

' -------------------------------------------------------------------------
' DIRECTION 1: Push MS Project tasks -> Web Tracker
' -------------------------------------------------------------------------
Public Sub PushMasterProjectToWebTracker()
    On Error GoTo EH
    
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
        Dim masterPath As String
        masterPath = GetMasterProjectPath()
        If Dir(masterPath) <> "" Then
            pj.FileOpenEx masterPath, ReadOnly:=True
        Else
            MsgBox "Please open your MS Project file before running this sync." & vbCrLf & _
                   "Could not find default file at: " & masterPath, vbExclamation
            Exit Sub
        End If
    End If
    
    Dim tasksCollection As Object
    Set tasksCollection = pj.ActiveProject.Tasks
    
    If tasksCollection.Count = 0 Then
        MsgBox "No tasks found in active project.", vbExclamation
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
            
            json = json & "{"
            json = json & """id"": """ & t.UniqueID & ""","
            json = json & """wbs"": """ & t.WBS & ""","
            json = json & """outlineLevel"": " & t.OutlineLevel & ","
            json = json & """name"": """ & CleanJson(t.Name) & ""","
            json = json & """isSummary"": " & IIf(t.Summary, "true", "false") & ","
            json = json & """quotedHours"": " & Replace(Format(quotedHrs, "0.00"), ",", ".") & ","
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
    http.Send json
    
    If http.Status = 200 Then
        MsgBox "Successfully synced " & taskCount & " tasks to the Web Tracker!" & vbCrLf & _
               "The team on site can now view and tick the updated tasks.", vbInformation, "Sync Successful"
    Else
        MsgBox "Sync error (" & http.Status & "): " & http.responseText, vbCritical, "Sync Failed"
    End If
    Exit Sub
    
EH:
    MsgBox "Error pushing to tracker: " & Err.Description, vbCritical
End Sub

' -------------------------------------------------------------------------
' DIRECTION 2: Pull Site Progress -> MS Project (% Complete = 100%)
' -------------------------------------------------------------------------
Public Sub PullSiteProgressIntoMSProject()
    On Error GoTo EH
    
    ' 1. Fetch completed tasks from API
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.Open "GET", API_BASE_URL & "/api/export-progress?format=json", False
    http.Send
    
    If http.Status <> 200 Then
        MsgBox "Could not fetch site progress (" & http.Status & "): " & http.responseText, vbCritical
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
    
    pj.FileSave
    
    MsgBox "Pull Complete!" & vbCrLf & _
           "Updated " & updatedCount & " task(s) to 100% complete in MS Project based on site ticks.", _
           vbInformation, "Site Progress Imported"
    Exit Sub
    
EH:
    MsgBox "Error pulling site progress: " & Err.Description, vbCritical
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
