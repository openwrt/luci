CBI models are Lua files describing the structure of an UCI config file and the resulting HTML form to be evaluated by the CBI parser.
All CBI model files must return an object of type *luci.cbi.Map*. For a commented example of a CBI model, see the [[Documentation/ModulesHowTo#CBImodels|Writing Modules tutorial]].

The scope of a CBI model file is automatically extended by the contents of the module *luci.cbi_' and the '_translate* function from luci.i18n

This Reference covers *the basics* of the CBI system.



# class Map (_config'', ''title'', ''description_)
This is the root object of the model.
* *config*: configuration name to be mapped, see uci documentation and the files in /etc/config
* *title*: title shown in the UI
* *description*: description shown in the UI

## :section (_sectionclass_, ...)
Creates a new section
* *sectionclass*: a class object of the section
* _additional parameters passed to the constructor of the section class_

----

# class NamedSection (_name'', ''type'', ''title'', ''description_)
An object describing an UCI section selected by the name.
Use [[#A.3Asection.28.27.27sectionclass.27.27.2C....29|Map:section(NamedSection, _name'', ''type'', ''title'', ''description_)]] to instantiate.
* *name*: section name
* *type*: section type
* *title*: The title shown in the UI
* *description*: description shown in the UI

## .addremove = false
Allows the user to remove and recreate the configuration section

## .dynamic = false
Marks this section as dynamic. Dynamic sections can contain an undefinded number of completely userdefined options.

## .optional = true
Parse optional options


## :option (_optionclass_, ...)
Creates a new option
* *optionclass*: a class object of the section
* _additional parameters passed to the constructor of the option class_

----

# class TypedSection (_type'', ''title'', ''description_)
An object describing a group of UCI sections selected by their type.
Use [[#A.3Asection.28.27.27sectionclass.27.27.2C....29|Map:section(TypedSection, _type'', ''title'', ''description_)]] to instantiate.
* *type*: section type
* *title*: The title shown in the UI
* *description*: description shown in the UI

## .addremove = false
Allows the user to remove and recreate the configuration section

## .dynamic = false
Marks this section as dynamic. Dynamic sections can contain an undefinded number of completely userdefined options.

## .optional = true
Parse optional options

## .anonymous = false
Do not show section names


## :depends (_key'', ''value_)
Only select those sections where the option _key'' == ''value_<br />
If you call this function several times the dependencies will be linked with *or*

## .filter (_self'', ''section_) [abstract]
You can override this function to filter certain sections that will not be parsed.
The filter function will be called for every section that should be parsed and returns *nil* for sections that should be filtered. For all other sections it should return the section name as given in the second parameter.

## :option (_optionclass_, ...)
Creates a new option
 _optionclass_: a class object of the section
 additional parameters passed to the constructor of the option class

----

# class Value (_option'', ''title'', ''description_)
An object describing an option in a section of a UCI File. Creates a standard text field in the formular.
Use [[#A.3Aoption.28.27.27optionclass.27.27.2C....29|NamedSection:option(Value, _option'', ''title'', ''description'')]] or [[#A.3Aoption.28.27.27optionclass.27.27.2C....29-1|TypedSection:option(Value, ''option'', ''title'', ''description_)]] to instantiate.
* *option*: section name
* *title*: The title shown in the UI
* *description*: description shown in the UI

## .default = nil
The default value

## .maxlength = nil
The maximum length of the value

## .optional = false
Marks this option as optional, implies .rmempty = true

## .rmempty = true
Removes this option from the configuration file when the user enters an empty value

## .size = nil
The size of the form field

## :value (_key'', ''value'' = ''key_)
Convert this text field into a combobox if possible and add a selection option.


## :depends (_key'', ''value_)
Only show this option field if another option _key'' is set to ''value_ in the same section.<br />
If you call this function several times the dependencies will be linked with *or*

----

# class ListValue (_option'', ''title'', ''description_)
An object describing an option in a section of a UCI File. Creates a list box in the formular.
Use [[#A.3Aoption.28.27.27optionclass.27.27.2C....29|NamedSection:option(Value, _option'', ''title'', ''description'')]] or [[#A.3Aoption.28.27.27optionclass.27.27.2C....29-1|TypedSection:option(Value, ''option'', ''title'', ''description_)]] to instantiate.
* *option*: section name
* *title*: The title shown in the UI
* *description*: description shown in the UI


## .default = nil
The default value

## .optional = false
Marks this option as optional, implies .rmempty = true

## .rmempty = true
Removes this option from the configuration file when the user enters an empty value

## .size = nil
The size of the form field

## .widget = "select"
selects the form widget to be used


## :depends (_key'', ''value_)
Only show this option field if another option _key'' is set to ''value_ in the same section.<br />
If you call this function several times the dependencies will be linked with *or*

## :value (_key'', ''value'' = ''key_)
Adds an entry to the selection list

----

# class Flag (_option'', ''title'', ''description_)
An object describing an option with two possible values in a section of a UCI File. Creates a checkbox field in the formular.
Use [[#A.3Aoption.28.27.27optionclass.27.27.2C....29|NamedSection:option(Value, _option'', ''title'', ''description'')]] or [[#A.3Aoption.28.27.27optionclass.27.27.2C....29-1|TypedSection:option(Value, ''option'', ''title'', ''description_)]] to instantiate.
* *option*: section name
* *title*: The title shown in the UI
* *description*: description shown in the UI

## .default = nil
The default value

## .disabled = 0
the value that shoudl be set if the checkbox is unchecked

## .enabled = 1
the value that should be set if the checkbox is checked

## .optional = false
Marks this option as optional, implies .rmempty = true

## .rmempty = true
Removes this option from the configuration file when the user enters an empty value

## .size = nil
The size of the form field


## :depends (_key'', ''value_)
Only show this option field if another option _key'' is set to ''value_ in the same section.<br />
If you call this function several times the dependencies will be linked with *or*

----

# class MultiValue (_option'', ''title'', ''description_)
An object describing an option in a section of a UCI File. Creates several checkboxed as form fields.
Use [[#A.3Aoption.28.27.27optionclass.27.27.2C....29|NamedSection:option(Value, _option'', ''title'', ''description'')]] or [[#A.3Aoption.28.27.27optionclass.27.27.2C....29-1|TypedSection:option(Value, ''option'', ''title'', ''description_)]] to instantiate.
* *option*: section name
* *title*: The title shown in the UI
* *description*: description shown in the UI


## .default = nil
The default value

## .delimiter = " "
The string which will be used to delimit the values

## .optional = false
Marks this option as optional, implies .rmempty = true

## .rmempty = true
Removes this option from the configuration file when the user enters an empty value

## .size = nil
The size of the form field

## .widget = "checkbox"
selects the form widget to be used


## :depends (_key'', ''value_)
Only show this option field if another option _key'' is set to ''value_ in the same section.<br />
If you call this function several times the dependencies will be linked with *or*

## :value (_key'', ''value'' = ''key_)
Adds an entry to the checkbox list

----

# class DummyValue (_option'', ''title'', ''description_)
An object describing an option in a section of a UCI File. Creates a readonly field in the form.
Use [[#A.3Aoption.28.27.27optionclass.27.27.2C....29|NamedSection:option(Value, _option'', ''title'', ''description'')]] or [[#A.3Aoption.28.27.27optionclass.27.27.2C....29-1|TypedSection:option(Value, ''option'', ''title'', ''description_)]] to instantiate.
* *option*: section name
* *title*: The title shown in the UI
* *description*: description shown in the UI



## :depends (_key'', ''value_)
Only show this option field if another option _key'' is set to ''value_ in the same section.<br />
If you call this function several times the dependencies will be linked with *or*

----


# class TextValue (_option'', ''title'', ''description_)
An object describing a multi-line textbox in a section in a non-UCI form.

----

# class Button (_option'', ''title'', ''description_)
An object describing a Button in a section in a non-UCI form.

----

# class StaticList (_option'', ''title'', ''description_)
Similar to the MultiValue, but stores selected Values into a UCI list instead of a space-separated string.

----

# class DynamicList (_option'', ''title'', ''description_)
A list of user-defined values.
