Attribute VB_Name = "ExportToTracker"
Option Explicit

' =========================================================================
' Protemp Project Tracker: Master & Subproject Exporter
' Exports the complete WBS task hierarchy from Master Project.mpp to JSON
' =========================================================================

Public Sub ExportMasterProjectToJSON()
    On Error GoTo EH
    
    Dim masterPath As String
    masterPath = "C:\Users\RolandSchroeder\OneDrive - Protemp\Protemp Operations\MS Project\Master Project.mpp"
    
    Dim jsonOutputPath As String
    jsonOutputPath = "C:\Users\RolandSchroeder\OneDrive - Protemp\Protemp Operations\MS Project\project_tree.json"
    
    Dim pj As Object
    On Error Resume Next
    Set pj = GetObject(, "MSProject.Application")
    If pj Is Nothing Then
        Set pj = CreateObject("MSProject.Application")
    End If
    On Error GoTo EH
    
    If pj Is Nothing Then
        MsgBox "Could not start Microsoft Project.", vbCritical
        Exit Sub
    End If
    
    pj.Visible = True
    pj.FileOpenEx masterPath, ReadOnly:=True
    
    Dim tasksCollection As Object
    Set tasksCollection = pj.ActiveProject.Tasks
    
    Dim json As String
    json = "["
    
    Dim t As Object
    Dim isFirst As Boolean
    isFirst = True
    
    Dim currentSubproject As String
    currentSubproject = "Master Project"
    
    For Each t In tasksCollection
        If Not t Is Nothing Then
            If Not isFirst Then json = json & "," & vbCrLf
            isFirst = False
            
            Dim tName As String
            tName = CleanJsonString(t.Name)
            
            Dim subProj As String
            subProj = ""
            On Error Resume Next
            subProj = t.Subproject
            On Error GoTo EH
            If Len(subProj) = 0 Then subProj = currentSubproject
            
            ' Work in MS Project is in minutes, divide by 60 for hours
            Dim quotedHrs As Double
            quotedHrs = 0
            On Error Resume Next
            quotedHrs = Round(t.Work / 60#, 2)
            On Error GoTo EH
            
            json = json & "  {"
            json = json & """id"": """ & t.UniqueID & ""","
            json = json & """wbs"": """ & t.WBS & ""","
            json = json & """outlineLevel"": " & t.OutlineLevel & ","
            json = json & """name"": """ & tName & ""","
            json = json & """isSummary"": " & IIf(t.Summary, "true", "false") & ","
            json = json & """quotedHours"": " & Str(quotedHrs) & ","
            json = json & """subprojectName"": """ & CleanJsonString(subProj) & """"
            json = json & "}"
        End If
    Next t
    
    json = json & vbCrLf & "]"
    
    ' Write JSON file UTF-8
    Dim fso As Object, f As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set f = fso.CreateTextFile(jsonOutputPath, True, False)
    f.Write json
    f.Close
    
    MsgBox "Successfully exported " & tasksCollection.Count & " tasks to:" & vbCrLf & jsonOutputPath, vbInformation, "Sync Complete"
    Exit Sub
    
EH:
    MsgBox "Export error: " & Err.Description, vbCritical
End Sub

Private Function CleanJsonString(ByVal s As String) As String
    s = Replace$(s, "\", "\\")
    s = Replace$(s, """", "\""")
    s = Replace$(s, vbCrLf, " ")
    s = Replace$(s, vbCr, " ")
    s = Replace$(s, vbLf, " ")
    s = Replace$(s, vbTab, " ")
    CleanJsonString = Trim$(s)
End Function
